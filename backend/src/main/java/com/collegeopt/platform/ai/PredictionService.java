package com.collegeopt.platform.ai;

import com.collegeopt.platform.activity.ActivityLogService;
import com.collegeopt.platform.booking.BookingService;
import com.collegeopt.platform.resource.ResourceDto;
import com.collegeopt.platform.resource.ResourceService;
import com.collegeopt.platform.resource.ResourceType;
import com.collegeopt.platform.timetable.TimetableService;
import com.collegeopt.platform.user.AppUser;
import com.collegeopt.platform.user.RoleType;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Service
public class PredictionService {

    private final ResourceService resourceService;
    private final TimetableService timetableService;
    private final BookingService bookingService;
    private final ActivityLogService activityLogService;

    public PredictionService(ResourceService resourceService,
                             TimetableService timetableService,
                             BookingService bookingService,
                             ActivityLogService activityLogService) {
        this.resourceService = resourceService;
        this.timetableService = timetableService;
        this.bookingService = bookingService;
        this.activityLogService = activityLogService;
    }

    public List<AiPredictionDto> predictionsFor(AppUser currentUser) {
        if (currentUser.roles().contains(RoleType.SUPER_ADMIN)) {
            return superAdminPredictions();
        }
        if (currentUser.roles().contains(RoleType.COLLEGE_ADMIN)) {
            return adminPredictions(currentUser);
        }
        if (currentUser.roles().contains(RoleType.FACULTY)) {
            return facultyPredictions(currentUser);
        }
        return studentPredictions(currentUser);
    }

    private List<AiPredictionDto> superAdminPredictions() {
        long labCount = resourceService.getAllResources().stream().filter(resource -> resource.type() == ResourceType.LAB).count();
        long totalBookings = bookingService.getAllBookings().size();
        int demand = (int) Math.min(96, 60 + totalBookings * 4 + labCount * 2);
        int changeCount = (int) activityLogService.listLogs().stream()
                .filter(log -> log.createdAt().isAfter(LocalDateTime.now().minusDays(7)))
                .count();

        return List.of(
                new AiPredictionDto(
                        "Campus lab demand",
                        "Historic booking volume and current lab inventory indicate elevated campus pressure next week.",
                        demand + "% expected utilization",
                        demand >= 85 ? "high" : "medium"
                ),
                new AiPredictionDto(
                        "Conflict carry-over risk",
                        "Unresolved timetable collisions can propagate into room shortages during the next planning cycle.",
                        timetableService.detectConflicts().size() + " conflict risk signals",
                        timetableService.detectConflicts().isEmpty() ? "medium" : "high"
                ),
                new AiPredictionDto(
                        "Operational volatility",
                        "Recent system changes are used as a signal for upcoming planning churn.",
                        changeCount + " admin changes this week",
                        changeCount >= 10 ? "high" : "medium"
                )
        );
    }

    private List<AiPredictionDto> adminPredictions(AppUser currentUser) {
        Long departmentId = currentUser.departmentId();
        List<ResourceDto> departmentResources = resourceService.getResourcesByDepartment(departmentId);
        long availableLabs = departmentResources.stream()
                .filter(resource -> resource.type() == ResourceType.LAB)
                .filter(resource -> "AVAILABLE".equalsIgnoreCase(resource.status().name()))
                .count();
        long deptConflicts = timetableService.detectConflicts(departmentId).size();
        int pressure = (int) Math.min(94, 45 + timetableService.listEntriesByDepartment(departmentId).size() * 3 - availableLabs * 4 + deptConflicts * 6);

        return List.of(
                new AiPredictionDto(
                        "Department timetable pressure",
                        "Faculty load, active entries, and conflict count suggest how tight the next schedule iteration will be.",
                        pressure + "% planning pressure",
                        pressure >= 80 ? "high" : "medium"
                ),
                new AiPredictionDto(
                        "Lab availability next week",
                        "Open lab inventory will likely shrink if current booking and timetable density continues.",
                        Math.max(0, availableLabs - 1) + " labs likely free at peak",
                        availableLabs <= 1 ? "high" : "medium"
                ),
                new AiPredictionDto(
                        "Conflict recurrence",
                        "Departments with unresolved overlaps are more likely to generate repeated clashes during edits.",
                        deptConflicts + " repeat-risk signals",
                        deptConflicts == 0 ? "low" : "high"
                )
        );
    }

    private List<AiPredictionDto> facultyPredictions(AppUser currentUser) {
        long myEntries = timetableService.listEntries().stream()
                .filter(entry -> entry.departmentId().equals(currentUser.departmentId()))
                .filter(entry -> entry.facultyName().equalsIgnoreCase(currentUser.fullName()) || entry.facultyUserId().equals(currentUser.id()))
                .count();
        long availableRooms = resourceService.getResourcesByDepartment(currentUser.departmentId()).stream()
                .filter(resource -> resource.type() == ResourceType.CLASSROOM || resource.type() == ResourceType.LAB)
                .filter(resource -> "AVAILABLE".equalsIgnoreCase(resource.status().name()))
                .count();

        return List.of(
                new AiPredictionDto(
                        "Schedule conflict risk",
                        "Your active teaching load is used to estimate the chance of accidental overlaps during manual edits.",
                        (myEntries > 6 ? "Elevated" : "Stable"),
                        myEntries > 6 ? "medium" : "low"
                ),
                new AiPredictionDto(
                        "Ad-hoc room availability",
                        "Current department room inventory suggests your probability of finding a same-day slot.",
                        availableRooms + " rooms likely available",
                        availableRooms == 0 ? "low" : "medium"
                ),
                new AiPredictionDto(
                        "Booking approval wait",
                        "Pending queue size indicates how quickly a new room request may move through workflow.",
                        bookingService.listPendingApprovals(currentUser).size() + " items in visible queue",
                        "medium"
                )
        );
    }

    private List<AiPredictionDto> studentPredictions(AppUser currentUser) {
        Map<String, Long> heatmap = timetableService.weeklyHeatmap(currentUser.departmentId());
        long busiestDayCount = heatmap.values().stream().mapToLong(Long::longValue).max().orElse(0);
        String busiestDay = heatmap.entrySet().stream()
                .max(Map.Entry.comparingByValue())
                .map(Map.Entry::getKey)
                .orElse("MONDAY");
        long availableClassrooms = resourceService.getResourcesByDepartment(currentUser.departmentId()).stream()
                .filter(resource -> resource.type() == ResourceType.CLASSROOM)
                .filter(resource -> "AVAILABLE".equalsIgnoreCase(resource.status().name()))
                .count();

        return List.of(
                new AiPredictionDto(
                        "Busiest upcoming day",
                        "Department timetable density indicates when campus movement and room competition will be strongest.",
                        busiestDay + " (" + busiestDayCount + " classes)",
                        "medium"
                ),
                new AiPredictionDto(
                        "Study-space availability",
                        "Current classroom inventory suggests likely room-finding success outside class peaks.",
                        availableClassrooms + " classrooms likely open",
                        availableClassrooms == 0 ? "low" : "medium"
                ),
                new AiPredictionDto(
                        "Announcement activity",
                        "Communication bursts usually follow timetable, resource, or event changes.",
                        "Expect updates around peak schedule days",
                        "low"
                )
        );
    }
}
