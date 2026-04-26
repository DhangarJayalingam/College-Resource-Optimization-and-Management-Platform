package com.collegeopt.platform.activity;

import com.collegeopt.platform.common.ApiResponse;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/activity-logs")
public class ActivityLogController {

    private final ActivityLogService activityLogService;

    public ActivityLogController(ActivityLogService activityLogService) {
        this.activityLogService = activityLogService;
    }

    @GetMapping
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','COLLEGE_ADMIN')")
    public ResponseEntity<ApiResponse<List<ActivityLogDto>>> listLogs() {
        return ResponseEntity.ok(ApiResponse.ok("Activity logs loaded", activityLogService.listLogs()));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<ActivityLogDto>> createLog(@Valid @RequestBody CreateActivityLogRequest request) {
        return ResponseEntity.ok(ApiResponse.ok("Activity logged", activityLogService.log(request)));
    }
}
