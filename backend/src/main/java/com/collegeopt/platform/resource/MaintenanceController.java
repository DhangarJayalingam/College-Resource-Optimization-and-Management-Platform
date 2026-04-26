package com.collegeopt.platform.resource;

import com.collegeopt.platform.common.ApiResponse;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/maintenance")
public class MaintenanceController {

    private final MaintenanceService maintenanceService;

    public MaintenanceController(MaintenanceService maintenanceService) {
        this.maintenanceService = maintenanceService;
    }

    @GetMapping
    public ResponseEntity<ApiResponse<List<MaintenanceDto>>> listAll() {
        return ResponseEntity.ok(ApiResponse.ok("Maintenance records loaded", maintenanceService.listAll()));
    }

    @GetMapping("/resource/{resourceId}")
    public ResponseEntity<ApiResponse<List<MaintenanceDto>>> listForResource(@PathVariable Long resourceId) {
        return ResponseEntity.ok(ApiResponse.ok("Maintenance records loaded", maintenanceService.listByResource(resourceId)));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('COLLEGE_ADMIN','SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<MaintenanceDto>> create(@Valid @RequestBody CreateMaintenanceRequest request) {
        return ResponseEntity.ok(ApiResponse.ok("Maintenance scheduled", maintenanceService.create(request)));
    }
}
