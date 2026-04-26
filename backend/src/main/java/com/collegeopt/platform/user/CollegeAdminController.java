package com.collegeopt.platform.user;

import com.collegeopt.platform.analytics.AnalyticsService;
import com.collegeopt.platform.booking.BookingService;
import com.collegeopt.platform.booking.ResourceRequestDto;
import com.collegeopt.platform.common.ApiResponse;
import com.collegeopt.platform.resource.ResourceService;
import com.collegeopt.platform.timetable.TimetableConflictDto;
import com.collegeopt.platform.timetable.TimetableService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/college-admin")
@PreAuthorize("hasAnyRole('COLLEGE_ADMIN','SUPER_ADMIN')")
public class CollegeAdminController {

    private final AnalyticsService analyticsService;
    private final BookingService bookingService;
    private final TimetableService timetableService;
    private final ResourceService resourceService;
    private final UserDirectoryService userDirectoryService;

    public CollegeAdminController(AnalyticsService analyticsService,
                                  BookingService bookingService,
                                  TimetableService timetableService,
                                  ResourceService resourceService,
                                  UserDirectoryService userDirectoryService) {
        this.analyticsService = analyticsService;
        this.bookingService = bookingService;
        this.timetableService = timetableService;
        this.resourceService = resourceService;
        this.userDirectoryService = userDirectoryService;
    }

    @GetMapping("/dashboard")
    public ResponseEntity<ApiResponse<?>> dashboard(Authentication authentication) {
        AppUser currentUser = currentUser(authentication);
        return ResponseEntity.ok(ApiResponse.ok("College admin dashboard", analyticsService.dashboard(currentUser)));
    }

    @GetMapping("/resource-requests")
    public ResponseEntity<ApiResponse<List<ResourceRequestDto>>> resourceRequests(Authentication authentication) {
        AppUser currentUser = currentUser(authentication);
        return ResponseEntity.ok(ApiResponse.ok("Pending and processed requests",
                currentUser.roles().contains(RoleType.SUPER_ADMIN)
                        ? bookingService.getAllRequests()
                        : bookingService.getRequestsForDepartment(currentUser.departmentId())));
    }

    @GetMapping("/conflicts")
    public ResponseEntity<ApiResponse<List<TimetableConflictDto>>> conflicts(Authentication authentication) {
        AppUser currentUser = currentUser(authentication);
        return ResponseEntity.ok(ApiResponse.ok("Detected timetable conflicts",
                currentUser.roles().contains(RoleType.SUPER_ADMIN)
                        ? timetableService.detectConflicts()
                        : timetableService.detectConflicts(currentUser.departmentId())));
    }

    @GetMapping("/resource-summary")
    public ResponseEntity<ApiResponse<Map<String, Object>>> resourceSummary(Authentication authentication) {
        AppUser currentUser = currentUser(authentication);
        return ResponseEntity.ok(ApiResponse.ok("Campus resource summary",
                currentUser.roles().contains(RoleType.SUPER_ADMIN)
                        ? resourceService.resourceUtilizationSummary()
                        : resourceService.resourceUtilizationSummary(currentUser.departmentId())));
    }

    private AppUser currentUser(Authentication authentication) {
        if (authentication == null || authentication.getName() == null || authentication.getName().isBlank()) {
            throw new IllegalArgumentException("Session expired. Please log in again.");
        }
        return userDirectoryService.findByEmail(authentication.getName())
                .orElseThrow(() -> new IllegalArgumentException("Authenticated user not found"));
    }
}
