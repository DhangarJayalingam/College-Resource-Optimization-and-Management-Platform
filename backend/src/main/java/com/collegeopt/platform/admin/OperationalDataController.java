package com.collegeopt.platform.admin;

import com.collegeopt.platform.common.ApiResponse;
import com.collegeopt.platform.user.AppUser;
import com.collegeopt.platform.user.UserDirectoryService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/operations")
public class OperationalDataController {

    private final OperationalDataService operationalDataService;
    private final UserDirectoryService userDirectoryService;

    public OperationalDataController(OperationalDataService operationalDataService,
                                     UserDirectoryService userDirectoryService) {
        this.operationalDataService = operationalDataService;
        this.userDirectoryService = userDirectoryService;
    }

    @PostMapping("/clear-data")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','COLLEGE_ADMIN')")
    public ResponseEntity<ApiResponse<OperationalDataResetResult>> clearOperationalData(
            Authentication authentication,
            @RequestBody(required = false) OperationalDataClearRequest request) {
        AppUser currentUser = userDirectoryService.findByEmail(authentication.getName())
                .orElseThrow(() -> new IllegalArgumentException("Session expired. Please log in again."));
        String mode = request == null || request.mode() == null ? "ALL" : request.mode();
        OperationalDataResetResult result = operationalDataService.clearOperationalData(currentUser, mode);
        return ResponseEntity.ok(ApiResponse.ok("Operational data cleared successfully", result));
    }
}
