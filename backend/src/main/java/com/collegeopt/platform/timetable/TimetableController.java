package com.collegeopt.platform.timetable;

import com.collegeopt.platform.common.ApiResponse;
import com.collegeopt.platform.resource.ResourceService;
import com.collegeopt.platform.user.AppUser;
import com.collegeopt.platform.user.RoleType;
import com.collegeopt.platform.user.UserDirectoryService;
import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;
import java.util.Objects;

@RestController
@RequestMapping("/api/v1/timetable")
public class TimetableController {

    private final TimetableService timetableService;
    private final TimetableBulkImportService timetableBulkImportService;
    private final ResourceService resourceService;
    private final UserDirectoryService userDirectoryService;

    public TimetableController(TimetableService timetableService,
                               TimetableBulkImportService timetableBulkImportService,
                               ResourceService resourceService,
                               UserDirectoryService userDirectoryService) {
        this.timetableService = timetableService;
        this.timetableBulkImportService = timetableBulkImportService;
        this.resourceService = resourceService;
        this.userDirectoryService = userDirectoryService;
    }

    @GetMapping
    public ResponseEntity<ApiResponse<List<TimetableEntryDto>>> getAllTimetableEntries(Authentication authentication) {
        AppUser currentUser = currentUserOrNull(authentication);
        List<TimetableEntryDto> entries = isDepartmentScoped(currentUser)
                ? timetableService.listEntriesByDepartment(currentUser.departmentId())
                : timetableService.listEntries();
        return ResponseEntity.ok(ApiResponse.ok("Timetable loaded", entries));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('COLLEGE_ADMIN','SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<TimetableEntryDto>> createManagedEntry(@Valid @RequestBody UpsertTimetableEntryRequest request,
                                                                             Authentication authentication) {
        ensureDepartmentAccess(currentUser(authentication), resourceService.getResource(request.resourceId()).departmentId());
        return ResponseEntity.ok(ApiResponse.ok("Timetable entry created", timetableService.createEntry(request)));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('COLLEGE_ADMIN','SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<TimetableEntryDto>> updateEntry(@PathVariable Long id,
                                                                      @Valid @RequestBody UpsertTimetableEntryRequest request,
                                                                      Authentication authentication) {
        AppUser currentUser = currentUser(authentication);
        ensureDepartmentAccess(currentUser, timetableService.getEntry(id).departmentId());
        ensureDepartmentAccess(currentUser, resourceService.getResource(request.resourceId()).departmentId());
        return ResponseEntity.ok(ApiResponse.ok("Timetable entry updated", timetableService.updateEntry(id, request)));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('COLLEGE_ADMIN','SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<Void>> deleteEntry(@PathVariable Long id, Authentication authentication) {
        ensureDepartmentAccess(currentUser(authentication), timetableService.getEntry(id).departmentId());
        timetableService.deleteEntry(id);
        return ResponseEntity.ok(ApiResponse.ok("Timetable entry deleted", null));
    }

    @GetMapping("/entries")
    public ResponseEntity<ApiResponse<List<TimetableEntryDto>>> getEntries(Authentication authentication) {
        return getAllTimetableEntries(authentication);
    }

    @PostMapping("/entries")
    @PreAuthorize("hasAnyRole('COLLEGE_ADMIN','SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<TimetableEntryDto>> createEntry(@Valid @RequestBody CreateTimetableEntryRequest request,
                                                                      Authentication authentication) {
        Long resourceId = request.classroomId() != null ? request.classroomId() : request.laboratoryId();
        if (resourceId != null) {
            ensureDepartmentAccess(currentUser(authentication), resourceService.getResource(resourceId).departmentId());
        }
        return ResponseEntity.ok(ApiResponse.ok("Timetable entry created", timetableService.createEntry(request)));
    }

    @GetMapping("/conflicts")
    public ResponseEntity<ApiResponse<List<TimetableConflictDto>>> getConflicts(Authentication authentication) {
        AppUser currentUser = currentUserOrNull(authentication);
        List<TimetableConflictDto> conflicts = isDepartmentScoped(currentUser)
                ? timetableService.detectConflicts(currentUser.departmentId())
                : timetableService.detectConflicts();
        return ResponseEntity.ok(ApiResponse.ok("Conflict analysis completed", conflicts));
    }

    @PostMapping("/generate-ai")
    @PreAuthorize("hasAnyRole('COLLEGE_ADMIN','SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<List<TimetableEntryDto>>> generateWithAi(@Valid @RequestBody TimetableGenerateRequest request) {
        return ResponseEntity.ok(ApiResponse.ok("AI timetable generated", timetableService.generateAiTimetable(request)));
    }

    @PostMapping("/bulk-upload")
    @PreAuthorize("hasAnyRole('COLLEGE_ADMIN','SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> bulkUpload(@RequestParam("file") MultipartFile file,
                                                                       Authentication authentication) {
        Map<String, Object> result = timetableBulkImportService.bulkUpload(file, currentUser(authentication));
        return ResponseEntity.ok(ApiResponse.ok("Bulk timetable upload processed", result));
    }

    @GetMapping("/bulk-template")
    @PreAuthorize("hasAnyRole('COLLEGE_ADMIN','SUPER_ADMIN')")
    public ResponseEntity<byte[]> downloadBulkTemplate(Authentication authentication) {
        byte[] payload = timetableBulkImportService.buildTemplate(currentUser(authentication));
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=timetable-bulk-template.xlsx")
                .contentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
                .body(payload);
    }

    @GetMapping("/faculty-workload")
    public ResponseEntity<ApiResponse<Map<String, Long>>> workload(Authentication authentication) {
        AppUser currentUser = currentUserOrNull(authentication);
        Map<String, Long> workload = isDepartmentScoped(currentUser)
                ? timetableService.facultyWorkloadDistribution(currentUser.departmentId())
                : timetableService.facultyWorkloadDistribution();
        return ResponseEntity.ok(ApiResponse.ok("Faculty workload distribution", workload));
    }

    @GetMapping("/weekly-heatmap")
    public ResponseEntity<ApiResponse<Map<String, Long>>> weeklyHeatmap(Authentication authentication) {
        AppUser currentUser = currentUserOrNull(authentication);
        Map<String, Long> heatmap = isDepartmentScoped(currentUser)
                ? timetableService.weeklyHeatmap(currentUser.departmentId())
                : timetableService.weeklyHeatmap();
        return ResponseEntity.ok(ApiResponse.ok("Weekly schedule heatmap", heatmap));
    }

    private AppUser currentUserOrNull(Authentication authentication) {
        if (authentication == null || authentication.getName() == null || authentication.getName().isBlank()) {
            return null;
        }
        return userDirectoryService.findByEmail(authentication.getName()).orElse(null);
    }

    private AppUser currentUser(Authentication authentication) {
        AppUser user = currentUserOrNull(authentication);
        if (user == null) {
            throw new IllegalArgumentException("Session expired. Please log in again.");
        }
        return user;
    }

    private boolean isDepartmentScoped(AppUser user) {
        return user != null && !user.roles().contains(RoleType.SUPER_ADMIN);
    }

    private void ensureDepartmentAccess(AppUser user, Long departmentId) {
        if (!isDepartmentScoped(user)) {
            return;
        }
        if (!Objects.equals(user.departmentId(), departmentId)) {
            throw new IllegalArgumentException("Access restricted to your own department");
        }
    }
}
