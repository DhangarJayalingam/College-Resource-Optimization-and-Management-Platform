package com.collegeopt.platform.booking;

import com.collegeopt.platform.activity.ActivityLogService;
import com.collegeopt.platform.activity.CreateActivityLogRequest;
import com.collegeopt.platform.resource.ResourceDto;
import com.collegeopt.platform.resource.ResourceService;
import com.collegeopt.platform.timetable.TimetableEntryDto;
import com.collegeopt.platform.timetable.TimetableService;
import com.collegeopt.platform.user.AppUser;
import com.collegeopt.platform.user.RoleType;
import com.collegeopt.platform.user.UserDirectoryService;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import java.sql.PreparedStatement;
import java.sql.Statement;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;
import java.util.Map;

@Service
public class BookingService {

    private final JdbcTemplate jdbcTemplate;
    private final TimetableService timetableService;
    private final ActivityLogService activityLogService;
    private final ResourceService resourceService;
    private final UserDirectoryService userDirectoryService;
    private final BookingEngineService bookingEngineService;

    public BookingService(JdbcTemplate jdbcTemplate,
                          TimetableService timetableService,
                          ActivityLogService activityLogService,
                          ResourceService resourceService,
                          UserDirectoryService userDirectoryService,
                          BookingEngineService bookingEngineService) {
        this.jdbcTemplate = jdbcTemplate;
        this.timetableService = timetableService;
        this.activityLogService = activityLogService;
        this.resourceService = resourceService;
        this.userDirectoryService = userDirectoryService;
        this.bookingEngineService = bookingEngineService;
        ensureTables();
    }

    public List<ResourceRequestDto> getAllRequests() {
        return jdbcTemplate.query(
                """
                        SELECT id, request_type, requester_user_id, resource_id, requested_date, start_time, end_time,
                               reason, status, approved_by_user_id, approved_at
                        FROM app_resource_requests
                        ORDER BY id DESC
                        """,
                (rs, rowNum) -> new ResourceRequestDto(
                        rs.getLong("id"),
                        rs.getString("request_type"),
                        rs.getLong("requester_user_id"),
                        rs.getLong("resource_id"),
                        rs.getObject("requested_date", LocalDate.class),
                        rs.getTime("start_time").toLocalTime(),
                        rs.getTime("end_time").toLocalTime(),
                        rs.getString("reason"),
                        rs.getString("status"),
                        rs.getObject("approved_by_user_id", Long.class),
                        rs.getTimestamp("approved_at") == null ? null : rs.getTimestamp("approved_at").toLocalDateTime()
                )
        );
    }

    public List<ResourceRequestDto> getRequestsForDepartment(Long departmentId) {
        return getAllRequests().stream()
                .filter(request -> resourceService.getResource(request.resourceId()).departmentId().equals(departmentId))
                .toList();
    }

    public List<FacilityBookingDto> getAllBookings() {
        return jdbcTemplate.query(
                """
                        SELECT id, request_id, booked_by_user_id, resource_type, resource_id, booking_date,
                               start_time, end_time, status, created_at
                        FROM app_facility_bookings
                        ORDER BY id DESC
                        """,
                (rs, rowNum) -> new FacilityBookingDto(
                        rs.getLong("id"),
                        rs.getLong("request_id"),
                        rs.getLong("booked_by_user_id"),
                        rs.getString("resource_type"),
                        rs.getLong("resource_id"),
                        rs.getObject("booking_date", LocalDate.class),
                        rs.getTime("start_time").toLocalTime(),
                        rs.getTime("end_time").toLocalTime(),
                        rs.getString("status"),
                        rs.getTimestamp("created_at").toLocalDateTime()
                )
        );
    }

    public List<FacilityBookingDto> getBookingsForDepartment(Long departmentId) {
        return getAllBookings().stream()
                .filter(booking -> resourceService.getResource(booking.resourceId()).departmentId().equals(departmentId))
                .toList();
    }

    public ResourceRequestDto createRequest(ResourceRequestCreateRequest request) {
        ensureLegacyBookingWindowAvailable(request.resourceId(), request.date(), request.startTime(), request.endTime());
        KeyHolder keyHolder = new GeneratedKeyHolder();
        jdbcTemplate.update(connection -> {
            PreparedStatement statement = connection.prepareStatement(
                    """
                            INSERT INTO app_resource_requests (
                                request_type, requester_user_id, resource_id, requested_date, start_time, end_time,
                                reason, status, approved_by_user_id, approved_at
                            )
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                            """,
                    Statement.RETURN_GENERATED_KEYS
            );
            statement.setString(1, request.requestType().toUpperCase());
            statement.setLong(2, request.requesterUserId());
            statement.setLong(3, request.resourceId());
            statement.setObject(4, request.date());
            statement.setTime(5, java.sql.Time.valueOf(request.startTime()));
            statement.setTime(6, java.sql.Time.valueOf(request.endTime()));
            statement.setString(7, request.reason());
            statement.setString(8, "PENDING");
            statement.setNull(9, java.sql.Types.BIGINT);
            statement.setNull(10, java.sql.Types.TIMESTAMP);
            return statement;
        }, keyHolder);

        Number id = keyHolder.getKey();
        if (id == null) {
            throw new IllegalStateException("Could not create request");
        }

        ResourceRequestDto dto = new ResourceRequestDto(
                id.longValue(),
                request.requestType().toUpperCase(),
                request.requesterUserId(),
                request.resourceId(),
                request.date(),
                request.startTime(),
                request.endTime(),
                request.reason(),
                "PENDING",
                null,
                null
        );
        activityLogService.log(new CreateActivityLogRequest(request.requesterUserId(), "Booking requested", "BOOKING_REQUEST", dto.id(), Map.of("resourceId", request.resourceId())));
        return dto;
    }

    public ResourceRequestDto approveRequest(Long requestId, ApproveRequestAction action) {
        ResourceRequestDto existing = getAllRequests().stream()
                .filter(r -> r.id().equals(requestId))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Request not found"));

        LocalDateTime approvedAt = LocalDateTime.now();
        jdbcTemplate.update(
                """
                        UPDATE app_resource_requests
                        SET status = 'APPROVED', approved_by_user_id = ?, approved_at = ?
                        WHERE id = ?
                        """,
                action.approverUserId(),
                approvedAt,
                requestId
        );

        jdbcTemplate.update(
                """
                        INSERT INTO app_facility_bookings (
                            request_id, booked_by_user_id, resource_type, resource_id, booking_date,
                            start_time, end_time, status, created_at
                        )
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """,
                existing.id(),
                existing.requesterUserId(),
                existing.requestType(),
                existing.resourceId(),
                existing.requestedDate(),
                existing.startTime(),
                existing.endTime(),
                "APPROVED",
                approvedAt
        );

        return new ResourceRequestDto(existing.id(), existing.requestType(), existing.requesterUserId(),
                existing.resourceId(), existing.requestedDate(), existing.startTime(), existing.endTime(),
                existing.reason(), "APPROVED", action.approverUserId(), approvedAt);
    }

    public ResourceRequestDto rejectRequest(Long requestId, ApproveRequestAction action) {
        ResourceRequestDto existing = getAllRequests().stream()
                .filter(r -> r.id().equals(requestId))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Request not found"));

        LocalDateTime approvedAt = LocalDateTime.now();
        jdbcTemplate.update(
                """
                        UPDATE app_resource_requests
                        SET status = 'REJECTED', approved_by_user_id = ?, approved_at = ?
                        WHERE id = ?
                        """,
                action.approverUserId(),
                approvedAt,
                requestId
        );

        return new ResourceRequestDto(existing.id(), existing.requestType(), existing.requesterUserId(),
                existing.resourceId(), existing.requestedDate(), existing.startTime(), existing.endTime(),
                existing.reason(), "REJECTED", action.approverUserId(), approvedAt);
    }

    public List<FacilityBookingDto> getBookingsForResource(Long resourceId) {
        return jdbcTemplate.query(
                """
                        SELECT id, request_id, booked_by_user_id, resource_type, resource_id, booking_date,
                               start_time, end_time, status, created_at
                        FROM app_facility_bookings
                        WHERE resource_id = ?
                        ORDER BY id DESC
                        """,
                (rs, rowNum) -> new FacilityBookingDto(
                        rs.getLong("id"),
                        rs.getLong("request_id"),
                        rs.getLong("booked_by_user_id"),
                        rs.getString("resource_type"),
                        rs.getLong("resource_id"),
                        rs.getObject("booking_date", LocalDate.class),
                        rs.getTime("start_time").toLocalTime(),
                        rs.getTime("end_time").toLocalTime(),
                        rs.getString("status"),
                        rs.getTimestamp("created_at").toLocalDateTime()
                ),
                resourceId
        );
    }

    public List<BookingDto> listHistory(AppUser currentUser) {
        return bookingEngineService.history(currentUser);
    }

    public List<BookingDto> listPendingApprovals(AppUser currentUser) {
        return bookingEngineService.pendingApprovals(currentUser);
    }

    public BookingDto createAdvancedBooking(BookingRequestDto request, AppUser currentUser) {
        return bookingEngineService.create(request, currentUser);
    }

    public BookingDto approveAdvancedBooking(Long bookingId, BookingActionDto action, AppUser approver) {
        return bookingEngineService.approve(bookingId, action, approver);
    }

    public BookingDto rejectAdvancedBooking(Long bookingId, BookingActionDto action, AppUser approver) {
        return bookingEngineService.reject(bookingId, action, approver);
    }

    public BookingDto cancelAdvancedBooking(Long bookingId, BookingActionDto action, AppUser actor) {
        return bookingEngineService.cancel(bookingId, action, actor);
    }

    public List<BookingRecommendationDto> recommend(com.collegeopt.platform.resource.ResourceType resourceType, Integer expectedCapacity, LocalDate date,
                                                    LocalTime startTime, LocalTime endTime, AppUser currentUser) {
        return bookingEngineService.recommend(resourceType, expectedCapacity, date, startTime, endTime, currentUser);
    }

    public List<BookingNotificationDto> notifications(AppUser currentUser) {
        return bookingEngineService.notifications(currentUser);
    }

    public BookingAnalyticsDto analytics(AppUser currentUser) {
        return bookingEngineService.analytics(currentUser);
    }

    private void ensureLegacyBookingWindowAvailable(Long resourceId, LocalDate date, LocalTime startTime, LocalTime endTime) {
        if (!startTime.isBefore(endTime)) {
            throw new IllegalArgumentException("Booking start time must be before end time");
        }
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth != null) {
            AppUser user = userDirectoryService.findByEmail(auth.getName()).orElse(null);
            ResourceDto resource = resourceService.getResource(resourceId);
            if (user != null && !user.roles().contains(RoleType.COLLEGE_ADMIN) && !user.roles().contains(RoleType.SUPER_ADMIN) && !user.departmentId().equals(resource.departmentId())) {
                throw new IllegalArgumentException("You can only book resources within your own department.");
            }
        }
        boolean bookingConflict = getAllBookings().stream().anyMatch(existing -> existing.resourceId().equals(resourceId)
                && existing.bookingDate().equals(date) && overlaps(existing.startTime(), existing.endTime(), startTime, endTime) && !"REJECTED".equalsIgnoreCase(existing.status()));
        if (bookingConflict) {
            throw new IllegalArgumentException("Resource already has a booking in the selected time window");
        }
        boolean timetableConflict = timetableService.listEntries().stream().anyMatch(entry -> matchesResource(entry, resourceId) && isRelevantDay(entry, date) && overlaps(entry.startTime(), entry.endTime(), startTime, endTime));
        if (timetableConflict) {
            throw new IllegalArgumentException("Selected resource is already occupied by timetable allocation");
        }
    }

    private boolean matchesResource(TimetableEntryDto entry, Long resourceId) {
        return resourceId.equals(entry.classroomId()) || resourceId.equals(entry.laboratoryId());
    }

    private boolean isRelevantDay(TimetableEntryDto entry, LocalDate date) {
        return entry.dayOfWeek().equalsIgnoreCase(date.getDayOfWeek().name());
    }

    private boolean overlaps(LocalTime existingStart, LocalTime existingEnd, LocalTime start, LocalTime end) {
        return existingStart.isBefore(end) && start.isBefore(existingEnd);
    }

    private void ensureTables() {
        jdbcTemplate.execute(
                """
                        CREATE TABLE IF NOT EXISTS app_resource_requests (
                            id BIGINT PRIMARY KEY AUTO_INCREMENT,
                            request_type VARCHAR(40) NOT NULL,
                            requester_user_id BIGINT NOT NULL,
                            resource_id BIGINT NOT NULL,
                            requested_date DATE NOT NULL,
                            start_time TIME NOT NULL,
                            end_time TIME NOT NULL,
                            reason TEXT NOT NULL,
                            status VARCHAR(40) NOT NULL,
                            approved_by_user_id BIGINT NULL,
                            approved_at DATETIME NULL
                        )
                        """
        );
        jdbcTemplate.execute(
                """
                        CREATE TABLE IF NOT EXISTS app_facility_bookings (
                            id BIGINT PRIMARY KEY AUTO_INCREMENT,
                            request_id BIGINT NOT NULL,
                            booked_by_user_id BIGINT NOT NULL,
                            resource_type VARCHAR(40) NOT NULL,
                            resource_id BIGINT NOT NULL,
                            booking_date DATE NOT NULL,
                            start_time TIME NOT NULL,
                            end_time TIME NOT NULL,
                            status VARCHAR(40) NOT NULL,
                            created_at DATETIME NOT NULL
                        )
                        """
        );
    }
}
