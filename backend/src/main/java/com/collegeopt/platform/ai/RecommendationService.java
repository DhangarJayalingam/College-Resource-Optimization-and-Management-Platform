package com.collegeopt.platform.ai;

import com.collegeopt.platform.booking.BookingService;
import com.collegeopt.platform.resource.ResourceDto;
import com.collegeopt.platform.resource.ResourceService;
import com.collegeopt.platform.resource.ResourceType;
import com.collegeopt.platform.timetable.TimetableConflictDto;
import com.collegeopt.platform.timetable.TimetableEntryDto;
import com.collegeopt.platform.timetable.TimetableService;
import com.collegeopt.platform.user.AppUser;
import com.collegeopt.platform.user.RoleType;
import org.springframework.stereotype.Service;

import java.util.Comparator;
import java.util.List;

@Service("aiRecommendationService")
public class RecommendationService {

    private final ResourceService resourceService;
    private final TimetableService timetableService;
    private final BookingService bookingService;

    public RecommendationService(ResourceService resourceService,
                                 TimetableService timetableService,
                                 BookingService bookingService) {
        this.resourceService = resourceService;
        this.timetableService = timetableService;
        this.bookingService = bookingService;
    }

    public List<AiRecommendationDto> recommendationsFor(AppUser currentUser) {
        if (currentUser.roles().contains(RoleType.SUPER_ADMIN)) {
            return superAdminRecommendations();
        }
        if (currentUser.roles().contains(RoleType.COLLEGE_ADMIN)) {
            return adminRecommendations(currentUser);
        }
        if (currentUser.roles().contains(RoleType.FACULTY)) {
            return facultyRecommendations(currentUser);
        }
        return studentRecommendations(currentUser);
    }

    private List<AiRecommendationDto> superAdminRecommendations() {
        return List.of(
                new AiRecommendationDto(
                        "Redistribute low-load buildings",
                        "Move flexible sessions from overloaded departments into underutilized buildings to improve campus utilization.",
                        "Review building-level timetable allocation before next cycle.",
                        "high"
                ),
                new AiRecommendationDto(
                        "Increase lab capacity planning",
                        "Projected lab demand is trending higher than current idle inventory can comfortably absorb.",
                        "Reserve spare labs and delay non-critical maintenance during peak week.",
                        "high"
                ),
                new AiRecommendationDto(
                        "Use AI timetable balancing",
                        "Departments with uneven resource usage can be smoothed through shared room allocation windows.",
                        "Shift overflow classes into lower-pressure morning slots.",
                        "medium"
                )
        );
    }

    private List<AiRecommendationDto> adminRecommendations(AppUser currentUser) {
        Long departmentId = currentUser.departmentId();
        List<TimetableConflictDto> conflicts = timetableService.detectConflicts(departmentId);
        ResourceDto bestLab = resourceService.getResourcesByDepartment(departmentId).stream()
                .filter(resource -> resource.type() == ResourceType.LAB)
                .filter(resource -> "AVAILABLE".equalsIgnoreCase(resource.status().name()))
                .sorted(Comparator.comparingInt(ResourceDto::capacity).reversed())
                .findFirst()
                .orElse(null);

        return List.of(
                new AiRecommendationDto(
                        "Balance faculty workload",
                        "Move one late-slot class away from the most loaded faculty member to reduce overload risk.",
                        "Reassign a section or shift one session to a co-faculty slot.",
                        "high"
                ),
                new AiRecommendationDto(
                        "Activate idle lab capacity",
                        bestLab == null
                                ? "No open lab is currently available for reassignment."
                                : bestLab.name() + " is available and can absorb practical sessions with minimal disruption.",
                        bestLab == null ? "Review classroom-to-lab conversion options." : "Shift a congested practical batch into " + bestLab.name() + ".",
                        bestLab == null ? "medium" : "high"
                ),
                new AiRecommendationDto(
                        "Resolve timetable conflicts",
                        conflicts.isEmpty()
                                ? "The current timetable has no active department conflicts."
                                : "Existing clashes should be cleared before adding new sections.",
                        conflicts.isEmpty() ? "Keep current timetable stable." : "Prioritize the overlapping faculty or room entries first.",
                        conflicts.isEmpty() ? "low" : "high"
                )
        );
    }

    private List<AiRecommendationDto> facultyRecommendations(AppUser currentUser) {
        ResourceDto bestRoom = resourceService.getResourcesByDepartment(currentUser.departmentId()).stream()
                .filter(resource -> resource.type() == ResourceType.CLASSROOM || resource.type() == ResourceType.LAB)
                .filter(resource -> "AVAILABLE".equalsIgnoreCase(resource.status().name()))
                .sorted(Comparator.comparingInt(ResourceDto::capacity))
                .findFirst()
                .orElse(null);

        long pendingBookings = bookingService.listHistory(currentUser).stream()
                .filter(booking -> "PENDING".equalsIgnoreCase(booking.status().name()))
                .count();

        return List.of(
                new AiRecommendationDto(
                        "Smart room recommendation",
                        bestRoom == null
                                ? "No department room is currently open."
                                : bestRoom.name() + " is free now and suitable for a quick session or booking.",
                        bestRoom == null ? "Try a later slot or a neighboring department-approved space." : "Book " + bestRoom.name() + " for your next ad-hoc session.",
                        bestRoom == null ? "medium" : "high"
                ),
                new AiRecommendationDto(
                        "Conflict-safe planning",
                        "Use the assistant before adding manual timetable changes to avoid double-booking rooms or faculty time.",
                        "Check conflict warnings before finalizing class changes.",
                        "medium"
                ),
                new AiRecommendationDto(
                        "Booking follow-up",
                        pendingBookings + " of your bookings are still waiting in workflow.",
                        pendingBookings == 0 ? "No immediate follow-up needed." : "Plan alternatives for pending requests with tight deadlines.",
                        pendingBookings == 0 ? "low" : "medium"
                )
        );
    }

    private List<AiRecommendationDto> studentRecommendations(AppUser currentUser) {
        ResourceDto freeRoom = resourceService.getResourcesByDepartment(currentUser.departmentId()).stream()
                .filter(resource -> resource.type() == ResourceType.CLASSROOM)
                .filter(resource -> "AVAILABLE".equalsIgnoreCase(resource.status().name()))
                .sorted(Comparator.comparing(ResourceDto::name))
                .findFirst()
                .orElse(null);

        TimetableEntryDto nextEntry = timetableService.listEntriesByDepartment(currentUser.departmentId()).stream()
                .sorted(Comparator.comparing(TimetableEntryDto::dayOfWeek).thenComparing(TimetableEntryDto::startTime))
                .findFirst()
                .orElse(null);

        return List.of(
                new AiRecommendationDto(
                        "Free room finder",
                        freeRoom == null
                                ? "No classroom is currently available in your department."
                                : freeRoom.name() + " is open for short study or project work.",
                        freeRoom == null ? "Try the assistant again after the current slot." : "Use " + freeRoom.name() + " for the next available study window.",
                        freeRoom == null ? "medium" : "high"
                ),
                new AiRecommendationDto(
                        "Timetable guidance",
                        nextEntry == null
                                ? "No upcoming department timetable entry is available."
                                : "Your department's next visible class is " + nextEntry.courseCode() + " in " + nextEntry.resourceName() + ".",
                        "Ask the chatbot for the next class or room help anytime.",
                        "medium"
                ),
                new AiRecommendationDto(
                        "Announcement digest",
                        "Use the assistant to summarize notices instead of scanning the whole announcement feed manually.",
                        "Ask for today's or this week's announcement summary.",
                        "low"
                )
        );
    }
}
