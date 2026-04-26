package com.collegeopt.platform.ai;

import com.collegeopt.platform.activity.ActivityLogService;
import com.collegeopt.platform.analytics.AnalyticsService;
import com.collegeopt.platform.booking.BookingService;
import com.collegeopt.platform.booking.FacilityBookingDto;
import com.collegeopt.platform.campus.AnnouncementDto;
import com.collegeopt.platform.campus.AnnouncementService;
import com.collegeopt.platform.resource.ResourceDto;
import com.collegeopt.platform.resource.ResourceService;
import com.collegeopt.platform.resource.ResourceType;
import com.collegeopt.platform.timetable.TimetableConflictDto;
import com.collegeopt.platform.timetable.TimetableEntryDto;
import com.collegeopt.platform.timetable.TimetableService;
import com.collegeopt.platform.user.AppUser;
import com.collegeopt.platform.user.RoleType;
import org.springframework.stereotype.Service;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.TextStyle;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
public class InsightService {

    private final AnalyticsService analyticsService;
    private final ResourceService resourceService;
    private final TimetableService timetableService;
    private final BookingService bookingService;
    private final AnnouncementService announcementService;
    private final ActivityLogService activityLogService;

    public InsightService(AnalyticsService analyticsService,
                          ResourceService resourceService,
                          TimetableService timetableService,
                          BookingService bookingService,
                          AnnouncementService announcementService,
                          ActivityLogService activityLogService) {
        this.analyticsService = analyticsService;
        this.resourceService = resourceService;
        this.timetableService = timetableService;
        this.bookingService = bookingService;
        this.announcementService = announcementService;
        this.activityLogService = activityLogService;
    }

    public List<AiInsightDto> insightsFor(AppUser currentUser) {
        if (currentUser.roles().contains(RoleType.SUPER_ADMIN)) {
            return superAdminInsights();
        }
        if (currentUser.roles().contains(RoleType.COLLEGE_ADMIN)) {
            return adminInsights(currentUser);
        }
        if (currentUser.roles().contains(RoleType.FACULTY)) {
            return facultyInsights(currentUser);
        }
        return studentInsights(currentUser);
    }

    private List<AiInsightDto> superAdminInsights() {
        List<AiInsightDto> items = new ArrayList<>();
        Map<String, Object> overview = analyticsService.systemOverview();
        List<ResourceDto> resources = resourceService.getAllResources();

        Map<String, Long> buildingTotals = resources.stream()
                .collect(Collectors.groupingBy(ResourceDto::building, Collectors.counting()));
        Map<String, Long> buildingInUse = resources.stream()
                .filter(resource -> "IN_USE".equalsIgnoreCase(resource.status().name()))
                .collect(Collectors.groupingBy(ResourceDto::building, Collectors.counting()));

        buildingTotals.entrySet().stream()
                .min(Comparator.comparingDouble(entry -> utilizationPercent(buildingInUse.getOrDefault(entry.getKey(), 0L), entry.getValue())))
                .ifPresent(lowest -> items.add(new AiInsightDto(
                        lowest.getKey() + " is underutilized",
                        "This building currently has the lowest active-resource ratio across campus.",
                        String.format(Locale.ENGLISH, "%.0f%% utilized", utilizationPercent(buildingInUse.getOrDefault(lowest.getKey(), 0L), lowest.getValue())),
                        "medium"
                )));

        analyticsService.dashboard().departmentUsage().stream()
                .max(Comparator.comparingInt(item -> ((Number) item.get("utilizationPercent")).intValue()))
                .ifPresent(topDepartment -> items.add(new AiInsightDto(
                        topDepartment.get("department") + " leads department usage",
                        "This department is consuming the highest share of currently active resources.",
                        topDepartment.get("utilizationPercent") + "% utilization",
                        "high"
                )));

        long totalBookings = bookingService.getAllBookings().size();
        long totalLabs = resources.stream().filter(resource -> resource.type() == ResourceType.LAB).count();
        int projectedLabDemand = (int) Math.min(98, Math.round(55 + totalBookings * 4.0 + Math.max(totalLabs, 1)));
        items.add(new AiInsightDto(
                "Campus demand alert",
                "Booking pressure and active timetable load suggest a strong lab requirement next week.",
                projectedLabDemand + "% expected lab demand",
                projectedLabDemand >= 85 ? "high" : "medium"
        ));

        long recentActivity = activityLogService.listLogs().stream()
                .filter(log -> log.createdAt().isAfter(LocalDateTime.now().minusDays(7)))
                .count();
        items.add(new AiInsightDto(
                "Operational activity pulse",
                "Recent resource, booking, and timetable actions recorded in the platform during the last 7 days.",
                recentActivity + " logged changes",
                "low"
        ));

        items.add(new AiInsightDto(
                "Optimization opportunity",
                "Redistributing classes from overloaded departments into low-use buildings can improve campus utilization.",
                overview.get("conflicts") + " active conflicts",
                ((Number) overview.get("conflicts")).intValue() > 0 ? "high" : "medium"
        ));
        return items;
    }

    private List<AiInsightDto> adminInsights(AppUser currentUser) {
        Long departmentId = currentUser.departmentId();
        List<AiInsightDto> items = new ArrayList<>();
        Map<String, Long> workload = timetableService.facultyWorkloadDistribution(departmentId);
        List<ResourceDto> departmentResources = resourceService.getResourcesByDepartment(departmentId);
        List<TimetableEntryDto> departmentEntries = timetableService.listEntriesByDepartment(departmentId);
        List<TimetableConflictDto> conflicts = timetableService.detectConflicts(departmentId);

        workload.entrySet().stream()
                .max(Map.Entry.comparingByValue())
                .ifPresent(topFaculty -> items.add(new AiInsightDto(
                        topFaculty.getKey() + " has the heaviest load",
                        "This faculty member currently carries the highest scheduled teaching load in your department.",
                        topFaculty.getValue() + " scheduled hours",
                        topFaculty.getValue() >= 20 ? "high" : "medium"
                )));

        departmentResources.stream()
                .filter(resource -> resource.type() == ResourceType.LAB)
                .map(resource -> Map.entry(resource, idleHoursForResource(resource.id(), departmentEntries, bookingService.getBookingsForDepartment(departmentId))))
                .max(Comparator.comparingLong(Map.Entry::getValue))
                .ifPresent(idleLab -> items.add(new AiInsightDto(
                        idleLab.getKey().name() + " idle window",
                        "This lab has the largest unused block after comparing timetable and booking allocations.",
                        idleLab.getValue() + " idle hours/week",
                        idleLab.getValue() >= 10 ? "medium" : "low"
                )));

        items.add(new AiInsightDto(
                "Conflict prediction",
                conflicts.isEmpty()
                        ? "No current timetable collisions are detected in your department."
                        : "Your department currently has timetable overlaps that should be resolved before expansion.",
                conflicts.size() + " detected conflicts",
                conflicts.isEmpty() ? "low" : "high"
        ));

        long announcementCount = announcementService.listAnnouncementsForUser(currentUser).stream()
                .filter(announcement -> announcement.departmentId() == null || announcement.departmentId().equals(departmentId))
                .count();
        items.add(new AiInsightDto(
                "Department communication load",
                "Announcements visible to this department can be used to coordinate timetable or booking changes.",
                announcementCount + " visible announcements",
                "low"
        ));
        return items;
    }

    private List<AiInsightDto> facultyInsights(AppUser currentUser) {
        List<AiInsightDto> items = new ArrayList<>();
        List<TimetableEntryDto> myEntries = facultyEntries(currentUser);
        Optional<TimetableEntryDto> nextClass = nextUpcomingEntry(myEntries);
        List<TimetableConflictDto> myConflicts = timetableService.detectConflicts().stream()
                .filter(conflict -> conflictMatchesFaculty(conflict, myEntries))
                .toList();

        nextClass.ifPresent(entry -> items.add(new AiInsightDto(
                "Next teaching slot",
                entry.courseCode() + " for section " + entry.sectionCode() + " in " + entry.resourceName(),
                dayShort(entry.dayOfWeek()) + " " + formatTime(entry.startTime()),
                "low"
        )));

        items.add(new AiInsightDto(
                "Conflict watch",
                myConflicts.isEmpty()
                        ? "No faculty clashes are currently detected in your assigned timetable."
                        : "You have timetable overlap signals that need attention.",
                myConflicts.size() + " alerts",
                myConflicts.isEmpty() ? "low" : "high"
        ));

        long pendingBookings = bookingService.listHistory(currentUser).stream()
                .filter(booking -> "PENDING".equalsIgnoreCase(booking.status().name()))
                .count();
        items.add(new AiInsightDto(
                "Booking queue",
                "Your advanced booking requests are tracked here for quick follow-up.",
                pendingBookings + " pending bookings",
                pendingBookings > 0 ? "medium" : "low"
        ));

        availableDepartmentRooms(currentUser.departmentId()).stream().findFirst().ifPresent(resource -> items.add(new AiInsightDto(
                "Nearby room availability",
                resource.name() + " is currently available and fits ad-hoc teaching or mentoring use.",
                "Capacity " + resource.capacity(),
                "low"
        )));
        return items;
    }

    private List<AiInsightDto> studentInsights(AppUser currentUser) {
        List<AiInsightDto> items = new ArrayList<>();
        List<TimetableEntryDto> departmentEntries = timetableService.listEntriesByDepartment(currentUser.departmentId());

        nextUpcomingEntry(departmentEntries).ifPresent(entry -> items.add(new AiInsightDto(
                "Next class",
                entry.courseCode() + " in " + entry.resourceName(),
                dayShort(entry.dayOfWeek()) + " " + formatTime(entry.startTime()),
                "low"
        )));

        long freeRooms = availableDepartmentRooms(currentUser.departmentId()).size();
        items.add(new AiInsightDto(
                "Free study rooms",
                "Available classrooms and labs in your department that are not currently in use.",
                freeRooms + " spaces open now",
                freeRooms == 0 ? "medium" : "low"
        ));

        List<AnnouncementDto> announcements = announcementService.listAnnouncementsForUser(currentUser);
        long todayAnnouncements = announcements.stream()
                .filter(announcement -> announcement.publishedAt().toLocalDate().equals(LocalDate.now()))
                .count();
        items.add(new AiInsightDto(
                "Announcement summary",
                "New notices relevant to your access scope.",
                todayAnnouncements + " posted today",
                todayAnnouncements > 0 ? "medium" : "low"
        ));

        items.add(new AiInsightDto(
                "Assistant support",
                "Ask for free rooms, next classes, or announcement summaries through the AI chat panel.",
                "24/7 helper",
                "low"
        ));
        return items;
    }

    private double utilizationPercent(long active, long total) {
        if (total == 0) {
            return 0;
        }
        return active * 100.0 / total;
    }

    private long idleHoursForResource(Long resourceId,
                                      List<TimetableEntryDto> entries,
                                      List<FacilityBookingDto> bookings) {
        long scheduledHours = entries.stream()
                .filter(entry -> resourceId.equals(entry.classroomId()) || resourceId.equals(entry.laboratoryId()))
                .count();
        long bookedHours = bookings.stream()
                .filter(booking -> resourceId.equals(booking.resourceId()))
                .count();
        return Math.max(0, 18 - scheduledHours - bookedHours);
    }

    private List<TimetableEntryDto> facultyEntries(AppUser currentUser) {
        return timetableService.listEntries().stream()
                .filter(entry -> entry.departmentId().equals(currentUser.departmentId()))
                .filter(entry -> entry.facultyName().equalsIgnoreCase(currentUser.fullName()) || entry.facultyUserId().equals(currentUser.id()))
                .toList();
    }

    private Optional<TimetableEntryDto> nextUpcomingEntry(List<TimetableEntryDto> entries) {
        LocalDate today = LocalDate.now();
        LocalTime now = LocalTime.now();
        return entries.stream()
                .sorted(Comparator
                        .comparingInt((TimetableEntryDto entry) -> daysUntil(entry.dayOfWeek(), today))
                        .thenComparing(TimetableEntryDto::startTime))
                .filter(entry -> {
                    int daysAway = daysUntil(entry.dayOfWeek(), today);
                    return daysAway > 0 || !entry.startTime().isBefore(now);
                })
                .findFirst();
    }

    private boolean conflictMatchesFaculty(TimetableConflictDto conflict, List<TimetableEntryDto> facultyEntries) {
        return facultyEntries.stream().anyMatch(entry -> entry.id().equals(conflict.entryAId()) || entry.id().equals(conflict.entryBId()));
    }

    private List<ResourceDto> availableDepartmentRooms(Long departmentId) {
        return resourceService.getResourcesByDepartment(departmentId).stream()
                .filter(resource -> resource.type() == ResourceType.CLASSROOM || resource.type() == ResourceType.LAB)
                .filter(resource -> "AVAILABLE".equalsIgnoreCase(resource.status().name()))
                .sorted(Comparator.comparing(ResourceDto::name))
                .toList();
    }

    private int daysUntil(String dayOfWeekText, LocalDate today) {
        DayOfWeek targetDay = DayOfWeek.valueOf(dayOfWeekText.toUpperCase(Locale.ENGLISH));
        int current = today.getDayOfWeek().getValue();
        int target = targetDay.getValue();
        return (target - current + 7) % 7;
    }

    private String dayShort(String dayOfWeekText) {
        return DayOfWeek.valueOf(dayOfWeekText.toUpperCase(Locale.ENGLISH))
                .getDisplayName(TextStyle.SHORT, Locale.ENGLISH);
    }

    private String formatTime(LocalTime time) {
        return time.toString().substring(0, 5);
    }
}
