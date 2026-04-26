package com.collegeopt.platform.booking;

import com.collegeopt.platform.activity.ActivityLogService;
import com.collegeopt.platform.activity.CreateActivityLogRequest;
import com.collegeopt.platform.campus.ResourceStatusEventDto;
import com.collegeopt.platform.resource.ResourceDto;
import com.collegeopt.platform.resource.ResourceService;
import com.collegeopt.platform.resource.ResourceType;
import com.collegeopt.platform.timetable.TimetableService;
import com.collegeopt.platform.user.AppUser;
import com.collegeopt.platform.user.RoleType;
import com.collegeopt.platform.user.UserDirectoryService;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Service;

import java.sql.PreparedStatement;
import java.sql.Statement;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class BookingEngineService {

    private final JdbcTemplate jdbcTemplate;
    private final ResourceService resourceService;
    private final TimetableService timetableService;
    private final UserDirectoryService userDirectoryService;
    private final ConflictDetectionService conflictDetectionService;
    private final RecommendationService recommendationService;
    private final ApprovalService approvalService;
    private final WorkflowService workflowService;
    private final NotificationService notificationService;
    private final ResourceStatusPublisher resourceStatusPublisher;
    private final ActivityLogService activityLogService;

    public BookingEngineService(JdbcTemplate jdbcTemplate,
                                ResourceService resourceService,
                                TimetableService timetableService,
                                UserDirectoryService userDirectoryService,
                                ConflictDetectionService conflictDetectionService,
                                RecommendationService recommendationService,
                                ApprovalService approvalService,
                                WorkflowService workflowService,
                                NotificationService notificationService,
                                ResourceStatusPublisher resourceStatusPublisher,
                                ActivityLogService activityLogService) {
        this.jdbcTemplate = jdbcTemplate;
        this.resourceService = resourceService;
        this.timetableService = timetableService;
        this.userDirectoryService = userDirectoryService;
        this.conflictDetectionService = conflictDetectionService;
        this.recommendationService = recommendationService;
        this.approvalService = approvalService;
        this.workflowService = workflowService;
        this.notificationService = notificationService;
        this.resourceStatusPublisher = resourceStatusPublisher;
        this.activityLogService = activityLogService;
        ensureTables();
    }

    public List<BookingDto> history(AppUser currentUser) {
        refreshLifecycle();
        List<BookingDto> bookings = loadBookings();
        if (currentUser.roles().contains(RoleType.SUPER_ADMIN)) {
            return bookings;
        }
        return bookings.stream().filter(booking -> booking.userId().equals(currentUser.id())
                || (currentUser.roles().contains(RoleType.COLLEGE_ADMIN)
                && resourceService.getResource(booking.resourceId()).departmentId().equals(currentUser.departmentId())))
                .toList();
    }

    public List<BookingDto> pendingApprovals(AppUser currentUser) {
        refreshLifecycle();
        return loadBookings().stream()
                .filter(booking -> booking.status() == BookingStatus.PENDING)
                .filter(booking -> canApprove(booking, currentUser))
                .toList();
    }

    public BookingDto create(BookingRequestDto request, AppUser currentUser) {
        validate(request, currentUser);
        ResourceDto resource = resourceService.getResource(request.resourceId());
        boolean requiresApproval = workflowService.requiresApproval(currentUser, request.resourceType());
        ApprovalStage stage = requiresApproval
                ? workflowService.determineInitialStage(currentUser, request.resourceType(), request.recurring())
                : ApprovalStage.COMPLETED;
        LocalDateTime now = LocalDateTime.now();

        KeyHolder keyHolder = new GeneratedKeyHolder();
        jdbcTemplate.update(connection -> {
            PreparedStatement statement = connection.prepareStatement(
                    """
                            INSERT INTO bookings (
                                user_id, user_name, resource_id, resource_name, resource_type, booking_date,
                                start_time, end_time, purpose, status, approved_by, approved_at, remarks,
                                priority, requires_approval, current_approval_stage, recurring_pattern,
                                created_at, updated_at
                            )
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                            """,
                    Statement.RETURN_GENERATED_KEYS
            );
            statement.setLong(1, currentUser.id());
            statement.setString(2, currentUser.fullName());
            statement.setLong(3, resource.id());
            statement.setString(4, resource.name());
            statement.setString(5, resource.type().name());
            statement.setObject(6, request.date());
            statement.setTime(7, java.sql.Time.valueOf(request.startTime()));
            statement.setTime(8, java.sql.Time.valueOf(request.endTime()));
            statement.setString(9, request.purpose().trim());
            statement.setString(10, requiresApproval ? BookingStatus.PENDING.name() : BookingStatus.APPROVED.name());
            statement.setObject(11, requiresApproval ? null : currentUser.id());
            statement.setObject(12, requiresApproval ? null : java.sql.Timestamp.valueOf(now));
            statement.setString(13, defaultString(request.remarks()));
            statement.setString(14, request.priorityOverride() && currentUser.roles().contains(RoleType.SUPER_ADMIN)
                    ? BookingPriority.OVERRIDE.name()
                    : BookingPriority.NORMAL.name());
            statement.setBoolean(15, requiresApproval);
            statement.setString(16, stage.name());
            statement.setString(17, request.recurring() ? defaultString(request.recurringPattern()) : null);
            statement.setTimestamp(18, java.sql.Timestamp.valueOf(now));
            statement.setTimestamp(19, java.sql.Timestamp.valueOf(now));
            return statement;
        }, keyHolder);

        Number id = keyHolder.getKey();
        if (id == null) {
            throw new IllegalStateException("Could not create booking");
        }
        Long bookingId = id.longValue();

        addHistoryRecord(bookingId, currentUser.id(), currentUser.fullName(), stage, "REQUESTED", request.remarks());

        BookingDto booking = find(bookingId);
        activityLogService.log(new CreateActivityLogRequest(currentUser.id(), "Booking created", "BOOKING",
                booking.id(), Map.of("resourceId", booking.resourceId())));
        if (requiresApproval) {
            notifyApprovers(booking, resource.departmentId());
        } else {
            resourceStatusPublisher.publish(new ResourceStatusEventDto(resource.id(), resource.name(), "AVAILABLE",
                    "BOOKED", "Booking approved", LocalDateTime.now()));
        }
        return booking;
    }

    public BookingDto approve(Long bookingId, BookingActionDto action, AppUser approver) {
        BookingDto booking = find(bookingId);
        approvalService.validateApprovalAccess(booking, approver);
        ApprovalStage nextStage = booking.currentApprovalStage() == ApprovalStage.COLLEGE_ADMIN
                && (ResourceType.valueOf(booking.resourceType()) == ResourceType.LAB
                || ResourceType.valueOf(booking.resourceType()) == ResourceType.EQUIPMENT
                || booking.recurringPattern() != null) ? ApprovalStage.RESOURCE_MANAGER
                : ApprovalStage.COMPLETED;
        BookingDto updated = updateStatus(booking,
                nextStage == ApprovalStage.COMPLETED ? BookingStatus.APPROVED : BookingStatus.PENDING,
                nextStage, approver, "APPROVED", action.remarks());
        if (nextStage == ApprovalStage.COMPLETED) {
            resourceStatusPublisher.publish(new ResourceStatusEventDto(updated.resourceId(), updated.resourceName(),
                    "AVAILABLE", "BOOKED", "Booking approved", LocalDateTime.now()));
            notificationService.notifyUser(updated.userId(), "Booking Approved",
                    updated.resourceName() + " was approved", "BOOKING_APPROVED");
        } else {
            userDirectoryService.listUsers().stream().filter(user -> user.roles().contains(RoleType.SUPER_ADMIN))
                    .forEach(user -> notificationService.notifyUser(user.id(), "Final Approval Needed",
                            updated.resourceName() + " needs resource manager approval", "BOOKING_REQUEST"));
        }
        return updated;
    }

    public BookingDto reject(Long bookingId, BookingActionDto action, AppUser approver) {
        BookingDto booking = find(bookingId);
        BookingDto updated = updateStatus(booking, BookingStatus.REJECTED,
                booking.currentApprovalStage(), approver, "REJECTED", action.remarks());
        notificationService.notifyUser(updated.userId(), "Booking Rejected", updated.resourceName() + " was rejected",
                "BOOKING_REJECTED");
        return updated;
    }

    public BookingDto cancel(Long bookingId, BookingActionDto action, AppUser actor) {
        BookingDto booking = find(bookingId);
        if (!booking.userId().equals(actor.id()) && !actor.roles().contains(RoleType.COLLEGE_ADMIN)
                && !actor.roles().contains(RoleType.SUPER_ADMIN)) {
            throw new IllegalArgumentException("You cannot cancel this booking");
        }
        BookingDto updated = updateStatus(booking, BookingStatus.CANCELLED, booking.currentApprovalStage(), actor,
                "CANCELLED", action.remarks());
        resourceStatusPublisher.publish(new ResourceStatusEventDto(updated.resourceId(), updated.resourceName(),
                "BOOKED", "AVAILABLE", "Booking cancelled", LocalDateTime.now()));
        return updated;
    }

    public List<BookingRecommendationDto> recommend(ResourceType resourceType, Integer expectedCapacity, LocalDate date,
                                                    LocalTime startTime, LocalTime endTime, AppUser currentUser) {
        return recommendationService.recommend(resourceType, currentUser.departmentId(), expectedCapacity, date,
                startTime, endTime, loadBookings());
    }

    public List<BookingNotificationDto> notifications(AppUser currentUser) {
        return notificationService.getNotificationsForUser(currentUser.id());
    }

    public BookingAnalyticsDto analytics(AppUser currentUser) {
        List<BookingDto> visible = history(currentUser);
        List<Map<String, Object>> resourceUsage = visible.stream()
                .collect(LinkedHashMap<String, Long>::new,
                        (map, booking) -> incrementCount(map, booking.resourceName()), Map::putAll)
                .entrySet().stream()
                .map(entry -> Map.<String, Object>of("resource", entry.getKey(), "bookings", entry.getValue()))
                .toList();
        List<Map<String, Object>> peakHours = visible.stream()
                .collect(LinkedHashMap<String, Long>::new,
                        (map, booking) -> incrementCount(map, booking.startTime().toString()), Map::putAll)
                .entrySet().stream()
                .map(entry -> Map.<String, Object>of("hour", entry.getKey(), "count", entry.getValue())).toList();
        List<Map<String, Object>> trends = visible.stream()
                .collect(LinkedHashMap<LocalDate, Long>::new,
                        (map, booking) -> incrementCount(map, booking.date()), Map::putAll)
                .entrySet().stream()
                .map(entry -> Map.<String, Object>of("date", entry.getKey().toString(), "count", entry.getValue()))
                .toList();
        return new BookingAnalyticsDto(visible.size(),
                visible.stream().filter(booking -> booking.status() == BookingStatus.PENDING).count(),
                visible.stream().filter(booking -> booking.status() == BookingStatus.APPROVED).count(),
                visible.stream().filter(booking -> booking.status() == BookingStatus.COMPLETED).count(),
                visible.stream().filter(booking -> booking.status() == BookingStatus.CANCELLED).count(),
                resourceUsage, peakHours, trends);
    }

    private void validate(BookingRequestDto request, AppUser currentUser) {
        if (!request.startTime().isBefore(request.endTime())) {
            throw new IllegalArgumentException("End time must be after start time");
        }
        ResourceDto resource = resourceService.getResource(request.resourceId());
        if (!resource.type().equals(request.resourceType())) {
            throw new IllegalArgumentException("Resource type mismatch");
        }
        if (!currentUser.roles().contains(RoleType.SUPER_ADMIN)
                && !resource.departmentId().equals(currentUser.departmentId())) {
            throw new IllegalArgumentException("Cross-department booking is not allowed");
        }
        if (request.expectedCapacity() != null && request.expectedCapacity() > resource.capacity()) {
            throw new IllegalArgumentException("Selected resource cannot accommodate the expected capacity");
        }
        if (currentUser.roles().contains(RoleType.STUDENT) && request.resourceType() == ResourceType.LAB) {
            notificationService.notifyUser(currentUser.id(), "Lab Booking Submitted", "Lab requests require approval.",
                    "BOOKING_POLICY");
        }
        if (currentUser.roles().contains(RoleType.STUDENT) && loadBookings().stream()
                .filter(booking -> booking.userId().equals(currentUser.id()) && booking.date().equals(request.date())
                        && booking.status() != BookingStatus.CANCELLED && booking.status() != BookingStatus.REJECTED)
                .count() >= 2) {
            throw new IllegalArgumentException("Students can create at most 2 bookings per day");
        }
        List<BookingDto> existingBookings = loadBookings();
        conflictDetectionService.checkResourceConflict(existingBookings, null, request.resourceId(), request.date(),
                request.startTime(), request.endTime());
        conflictDetectionService.checkFacultyConflict(timetableService.listEntries(),
                currentUser.roles().contains(RoleType.FACULTY) ? currentUser.fullName() : null, request.date(),
                request.startTime(), request.endTime());
        conflictDetectionService.checkEquipmentConflict(existingBookings, null, request.resourceId(), request.resourceType(),
                request.date(), request.startTime(), request.endTime());
    }

    private BookingDto updateStatus(BookingDto booking, BookingStatus status, ApprovalStage stage, AppUser actor,
                                    String action, String remarks) {
        LocalDateTime now = LocalDateTime.now();
        jdbcTemplate.update(
                """
                        UPDATE bookings
                        SET status = ?, approved_by = ?, approved_at = ?, remarks = ?, current_approval_stage = ?, updated_at = ?
                        WHERE id = ?
                        """,
                status.name(),
                status == BookingStatus.APPROVED || status == BookingStatus.REJECTED ? actor.id() : booking.approvedBy(),
                status == BookingStatus.APPROVED || status == BookingStatus.REJECTED ? now : booking.approvedAt(),
                defaultString(remarks),
                stage.name(),
                now,
                booking.id()
        );
        addHistoryRecord(booking.id(), actor.id(), actor.fullName(), booking.currentApprovalStage(), action, remarks);
        BookingDto updated = find(booking.id());
        activityLogService.log(new CreateActivityLogRequest(actor.id(), "Booking " + action.toLowerCase(), "BOOKING",
                updated.id(), Map.of("status", updated.status().name())));
        return updated;
    }

    private BookingDto find(Long bookingId) {
        refreshLifecycle();
        List<BookingDto> matches = loadBookings().stream()
                .filter(booking -> booking.id().equals(bookingId))
                .toList();
        if (matches.isEmpty()) {
            throw new IllegalArgumentException("Booking not found");
        }
        return matches.get(0);
    }

    private boolean canApprove(BookingDto booking, AppUser currentUser) {
        return switch (booking.currentApprovalStage()) {
            case COLLEGE_ADMIN -> currentUser.roles().contains(RoleType.SUPER_ADMIN)
                    || currentUser.roles().contains(RoleType.COLLEGE_ADMIN) && resourceService
                    .getResource(booking.resourceId()).departmentId().equals(currentUser.departmentId());
            case RESOURCE_MANAGER -> currentUser.roles().contains(RoleType.SUPER_ADMIN);
            case COMPLETED -> false;
        };
    }

    private void notifyApprovers(BookingDto booking, Long departmentId) {
        if (booking.currentApprovalStage() == ApprovalStage.COLLEGE_ADMIN) {
            userDirectoryService.listAdmins().stream().filter(admin -> admin.departmentId().equals(departmentId))
                    .forEach(admin -> notificationService.notifyUser(admin.id(), "New Booking Request",
                            booking.resourceName() + " requires approval", "BOOKING_REQUEST"));
        } else {
            userDirectoryService.listUsers().stream().filter(user -> user.roles().contains(RoleType.SUPER_ADMIN))
                    .forEach(user -> notificationService.notifyUser(user.id(), "New Booking Request",
                            booking.resourceName() + " requires final approval", "BOOKING_REQUEST"));
        }
    }

    private void refreshLifecycle() {
        LocalDateTime now = LocalDateTime.now();
        for (BookingDto booking : loadBookings()) {
            if (booking.status() == BookingStatus.APPROVED && now.toLocalDate().equals(booking.date())
                    && !now.toLocalTime().isBefore(booking.startTime())
                    && now.toLocalTime().isBefore(booking.endTime())) {
                jdbcTemplate.update(
                        "UPDATE bookings SET status = ?, updated_at = ? WHERE id = ?",
                        BookingStatus.IN_PROGRESS.name(),
                        now,
                        booking.id()
                );
            } else if ((booking.status() == BookingStatus.APPROVED || booking.status() == BookingStatus.IN_PROGRESS)
                    && (now.toLocalDate().isAfter(booking.date()) || now.toLocalDate().equals(booking.date())
                    && !now.toLocalTime().isBefore(booking.endTime()))) {
                jdbcTemplate.update(
                        "UPDATE bookings SET status = ?, updated_at = ? WHERE id = ?",
                        BookingStatus.COMPLETED.name(),
                        now,
                        booking.id()
                );
                resourceStatusPublisher.publish(new ResourceStatusEventDto(booking.resourceId(), booking.resourceName(),
                        "BOOKED", "AVAILABLE", "Booking completed", LocalDateTime.now()));
            }
        }
    }

    private void addHistoryRecord(Long bookingId, Long actorId, String actorName, ApprovalStage stage,
                                  String action, String remarks) {
        LocalDateTime actionAt = LocalDateTime.now();
        jdbcTemplate.update(
                """
                        INSERT INTO booking_approval_history (
                            booking_id, stage, action, actor_user_id, actor_name, remarks, action_at
                        )
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                        """,
                bookingId,
                stage.name(),
                action,
                actorId,
                actorName,
                defaultString(remarks),
                actionAt
        );
    }

    private List<BookingDto> loadBookings() {
        return jdbcTemplate.query(
                """
                        SELECT id, user_id, user_name, resource_id, resource_name, resource_type, booking_date,
                               start_time, end_time, purpose, status, approved_by, approved_at, remarks, priority,
                               requires_approval, current_approval_stage, recurring_pattern, created_at, updated_at
                        FROM bookings
                        ORDER BY created_at DESC, id DESC
                        """,
                (rs, rowNum) -> {
                    Long bookingId = rs.getLong("id");
                    return new BookingDto(
                            bookingId,
                            rs.getLong("user_id"),
                            rs.getString("user_name"),
                            rs.getLong("resource_id"),
                            rs.getString("resource_name"),
                            rs.getString("resource_type"),
                            rs.getObject("booking_date", LocalDate.class),
                            rs.getTime("start_time").toLocalTime(),
                            rs.getTime("end_time").toLocalTime(),
                            rs.getString("purpose"),
                            BookingStatus.valueOf(rs.getString("status")),
                            rs.getObject("approved_by", Long.class),
                            rs.getTimestamp("approved_at") == null ? null : rs.getTimestamp("approved_at").toLocalDateTime(),
                            rs.getString("remarks"),
                            BookingPriority.valueOf(rs.getString("priority")),
                            rs.getBoolean("requires_approval"),
                            ApprovalStage.valueOf(rs.getString("current_approval_stage")),
                            rs.getString("recurring_pattern"),
                            loadApprovalHistory(bookingId),
                            rs.getTimestamp("created_at").toLocalDateTime(),
                            rs.getTimestamp("updated_at").toLocalDateTime()
                    );
                }
        );
    }

    private List<BookingApprovalHistoryDto> loadApprovalHistory(Long bookingId) {
        return jdbcTemplate.query(
                """
                        SELECT id, booking_id, stage, action, actor_user_id, actor_name, remarks, action_at
                        FROM booking_approval_history
                        WHERE booking_id = ?
                        ORDER BY action_at ASC, id ASC
                        """,
                (rs, rowNum) -> new BookingApprovalHistoryDto(
                        rs.getLong("id"),
                        rs.getLong("booking_id"),
                        ApprovalStage.valueOf(rs.getString("stage")),
                        rs.getString("action"),
                        rs.getLong("actor_user_id"),
                        rs.getString("actor_name"),
                        rs.getString("remarks"),
                        rs.getTimestamp("action_at").toLocalDateTime()
                ),
                bookingId
        );
    }

    private void ensureTables() {
        jdbcTemplate.execute(
                """
                        CREATE TABLE IF NOT EXISTS bookings (
                            id BIGINT PRIMARY KEY AUTO_INCREMENT,
                            user_id BIGINT NOT NULL,
                            user_name VARCHAR(255) NOT NULL,
                            resource_id BIGINT NOT NULL,
                            resource_name VARCHAR(255) NOT NULL,
                            resource_type VARCHAR(40) NOT NULL,
                            booking_date DATE NOT NULL,
                            start_time TIME NOT NULL,
                            end_time TIME NOT NULL,
                            purpose TEXT NOT NULL,
                            status VARCHAR(40) NOT NULL,
                            approved_by BIGINT NULL,
                            approved_at DATETIME NULL,
                            remarks TEXT NULL,
                            priority VARCHAR(40) NOT NULL,
                            requires_approval BOOLEAN NOT NULL,
                            current_approval_stage VARCHAR(40) NOT NULL,
                            recurring_pattern VARCHAR(255) NULL,
                            created_at DATETIME NOT NULL,
                            updated_at DATETIME NOT NULL
                        )
                        """
        );
        jdbcTemplate.execute(
                """
                        CREATE TABLE IF NOT EXISTS booking_approval_history (
                            id BIGINT PRIMARY KEY AUTO_INCREMENT,
                            booking_id BIGINT NOT NULL,
                            stage VARCHAR(40) NOT NULL,
                            action VARCHAR(60) NOT NULL,
                            actor_user_id BIGINT NOT NULL,
                            actor_name VARCHAR(255) NOT NULL,
                            remarks TEXT NULL,
                            action_at DATETIME NOT NULL
                        )
                        """
        );
    }

    private String defaultString(String value) {
        return value == null ? "" : value.trim();
    }

    private <T> void incrementCount(Map<T, Long> map, T key) {
        map.put(key, map.getOrDefault(key, 0L) + 1L);
    }
}
