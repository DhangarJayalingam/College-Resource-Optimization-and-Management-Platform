package com.collegeopt.platform.analytics;

import com.collegeopt.platform.common.ApiResponse;
import com.collegeopt.platform.user.AppUser;
import com.collegeopt.platform.user.UserDirectoryService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/analytics")
public class AnalyticsController {

    private final AnalyticsService analyticsService;
    private final UserDirectoryService userDirectoryService;

    public AnalyticsController(AnalyticsService analyticsService, UserDirectoryService userDirectoryService) {
        this.analyticsService = analyticsService;
        this.userDirectoryService = userDirectoryService;
    }

    @GetMapping("/dashboard")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<DashboardAnalyticsDto>> dashboard(Authentication authentication) {
        AppUser currentUser = userDirectoryService.findByEmail(authentication.getName())
                .orElseThrow(() -> new IllegalArgumentException("Authenticated user not found"));
        return ResponseEntity.ok(ApiResponse.ok("Dashboard analytics", analyticsService.dashboard(currentUser)));
    }

    @GetMapping("/system-overview")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','COLLEGE_ADMIN')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> systemOverview() {
        return ResponseEntity.ok(ApiResponse.ok("System overview", analyticsService.systemOverview()));
    }
}
