package com.collegeopt.platform.user;

import com.collegeopt.platform.analytics.AnalyticsService;
import com.collegeopt.platform.campus.CampusDto;
import com.collegeopt.platform.campus.CampusService;
import com.collegeopt.platform.campus.DepartmentDto;
import com.collegeopt.platform.common.ApiResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@RestController
@RequestMapping("/api/v1/admin")
@PreAuthorize("hasRole('SUPER_ADMIN')")
public class SuperAdminController {

    private final UserDirectoryService userDirectoryService;
    private final CampusService campusService;
    private final AnalyticsService analyticsService;
    private final Map<String, Object> aiSettings = new ConcurrentHashMap<>();

    public SuperAdminController(UserDirectoryService userDirectoryService,
                                CampusService campusService,
                                AnalyticsService analyticsService) {
        this.userDirectoryService = userDirectoryService;
        this.campusService = campusService;
        this.analyticsService = analyticsService;

        aiSettings.put("optimizerWeightCapacity", 0.55);
        aiSettings.put("optimizerWeightFeatureMatch", 0.45);
        aiSettings.put("conflictDetectionEnabled", true);
        aiSettings.put("demandPredictionWindowWeeks", 8);
    }

    @GetMapping("/users")
    public ResponseEntity<ApiResponse<List<AppUser>>> users() {
        return ResponseEntity.ok(ApiResponse.ok("All users", userDirectoryService.listUsers()));
    }

    @GetMapping("/campuses")
    public ResponseEntity<ApiResponse<List<CampusDto>>> campuses() {
        return ResponseEntity.ok(ApiResponse.ok("All campuses", campusService.listCampuses()));
    }

    @GetMapping("/departments")
    public ResponseEntity<ApiResponse<List<DepartmentDto>>> departments() {
        return ResponseEntity.ok(ApiResponse.ok("All departments", campusService.listDepartments()));
    }

    @GetMapping("/system-analytics")
    public ResponseEntity<ApiResponse<Map<String, Object>>> systemAnalytics() {
        Map<String, Object> payload = new LinkedHashMap<>(analyticsService.systemOverview());
        payload.put("tenantCount", 1);
        payload.put("campusCount", campusService.listCampuses().size());
        payload.put("departmentCount", campusService.listDepartments().size());
        return ResponseEntity.ok(ApiResponse.ok("Super admin analytics", payload));
    }

    @GetMapping("/ai-settings")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getAiSettings() {
        return ResponseEntity.ok(ApiResponse.ok("AI optimization settings", aiSettings));
    }

    @PostMapping("/ai-settings")
    public ResponseEntity<ApiResponse<Map<String, Object>>> updateAiSettings(@RequestBody Map<String, Object> settings) {
        aiSettings.putAll(settings);
        return ResponseEntity.ok(ApiResponse.ok("AI settings updated", aiSettings));
    }
}
