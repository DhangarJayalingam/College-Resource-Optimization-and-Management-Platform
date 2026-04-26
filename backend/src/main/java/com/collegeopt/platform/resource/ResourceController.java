package com.collegeopt.platform.resource;

import com.collegeopt.platform.common.ApiResponse;
import com.collegeopt.platform.user.AppUser;
import com.collegeopt.platform.user.RoleType;
import com.collegeopt.platform.user.UserDirectoryService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.time.LocalDate;

@RestController
@RequestMapping("/api/v1/resources")
public class ResourceController {

    private final ResourceService resourceService;
    private final UserDirectoryService userDirectoryService;

    public ResourceController(ResourceService resourceService, UserDirectoryService userDirectoryService) {
        this.resourceService = resourceService;
        this.userDirectoryService = userDirectoryService;
    }

    @GetMapping
    public ResponseEntity<ApiResponse<List<ResourceDto>>> getAllResources(Authentication authentication) {
        AppUser currentUser = currentUserOrNull(authentication);
        List<ResourceDto> resources = isDepartmentScoped(currentUser)
                ? resourceService.getResourcesByDepartment(currentUser.departmentId())
                : resourceService.getAllResources();
        return ResponseEntity.ok(ApiResponse.ok("Resources loaded", resources));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<ResourceDto>> getResource(@PathVariable Long id, Authentication authentication) {
        ResourceDto resource = resourceService.getResource(id);
        ensureDepartmentAccess(currentUserOrNull(authentication), resource.departmentId());
        return ResponseEntity.ok(ApiResponse.ok("Resource loaded", resource));
    }

    @GetMapping("/{id}/equipment")
    public ResponseEntity<ApiResponse<List<EquipmentDto>>> getEquipmentForResource(@PathVariable Long id, Authentication authentication) {
        ensureDepartmentAccess(currentUserOrNull(authentication), resourceService.getResource(id).departmentId());
        return ResponseEntity.ok(ApiResponse.ok("Resource equipment loaded", resourceService.getEquipmentForResource(id)));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('COLLEGE_ADMIN','SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<ResourceDto>> createResource(@Valid @RequestBody UpsertResourceRequest request,
                                                                   Authentication authentication) {
        AppUser currentUser = currentUser(authentication);
        ensureDepartmentAccess(currentUser, request.departmentId());
        return ResponseEntity.ok(ApiResponse.ok("Resource created", resourceService.createResource(request, currentUser.id())));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('COLLEGE_ADMIN','SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<ResourceDto>> updateResource(@PathVariable Long id,
                                                                   @Valid @RequestBody UpsertResourceRequest request,
                                                                   Authentication authentication) {
        AppUser currentUser = currentUser(authentication);
        ensureDepartmentAccess(currentUser, resourceService.getResource(id).departmentId());
        ensureDepartmentAccess(currentUser, request.departmentId());
        return ResponseEntity.ok(ApiResponse.ok("Resource updated", resourceService.updateResource(id, request, currentUser.id())));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('COLLEGE_ADMIN','SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<Void>> deleteResource(@PathVariable Long id, Authentication authentication) {
        AppUser currentUser = currentUser(authentication);
        ensureDepartmentAccess(currentUser, resourceService.getResource(id).departmentId());
        resourceService.deleteResource(id, currentUser.id());
        return ResponseEntity.ok(ApiResponse.ok("Resource deleted", null));
    }

    @GetMapping("/classrooms")
    public ResponseEntity<ApiResponse<List<ClassroomDto>>> getClassrooms(Authentication authentication) {
        AppUser currentUser = currentUserOrNull(authentication);
        List<ClassroomDto> classrooms = isDepartmentScoped(currentUser)
                ? resourceService.getClassroomsByDepartment(currentUser.departmentId())
                : resourceService.getClassrooms();
        return ResponseEntity.ok(ApiResponse.ok("Classrooms loaded", classrooms));
    }

    @GetMapping("/laboratories")
    public ResponseEntity<ApiResponse<List<LaboratoryDto>>> getLaboratories(Authentication authentication) {
        AppUser currentUser = currentUserOrNull(authentication);
        List<LaboratoryDto> laboratories = isDepartmentScoped(currentUser)
                ? resourceService.getResourcesByDepartment(currentUser.departmentId()).stream()
                .filter(resource -> resource.type() == ResourceType.LAB)
                .map(resource -> new LaboratoryDto(resource.id(), resource.name(), "GENERAL_LAB", resource.capacity(), resource.tags(), resource.status()))
                .toList()
                : resourceService.getLaboratories();
        return ResponseEntity.ok(ApiResponse.ok("Laboratories loaded", laboratories));
    }

    @GetMapping("/equipment")
    public ResponseEntity<ApiResponse<List<EquipmentDto>>> getEquipment(Authentication authentication) {
        AppUser currentUser = currentUserOrNull(authentication);
        List<EquipmentDto> equipment = isDepartmentScoped(currentUser)
                ? resourceService.getResourcesByDepartment(currentUser.departmentId()).stream()
                .filter(resource -> resource.type() == ResourceType.EQUIPMENT)
                .map(resource -> {
                    String category = resource.tags().stream().findFirst().orElse("GENERAL");
                    return new EquipmentDto(resource.id(), "EQ-" + resource.id(), resource.name(), category, resource.status(), resource.assignedLabId());
                })
                .toList()
                : resourceService.getEquipmentAssets();
        return ResponseEntity.ok(ApiResponse.ok("Equipment loaded", equipment));
    }

    @GetMapping("/utilization-summary")
    public ResponseEntity<ApiResponse<Map<String, Object>>> getUtilizationSummary(Authentication authentication) {
        AppUser currentUser = currentUserOrNull(authentication);
        Map<String, Object> summary = isDepartmentScoped(currentUser)
                ? resourceService.resourceUtilizationSummary(currentUser.departmentId())
                : resourceService.resourceUtilizationSummary();
        return ResponseEntity.ok(ApiResponse.ok("Resource utilization summary", summary));
    }

    @GetMapping("/dashboard")
    public ResponseEntity<ApiResponse<ResourceDashboardDto>> getDashboard(Authentication authentication) {
        AppUser currentUser = currentUserOrNull(authentication);
        ResourceDashboardDto dashboard = resourceService.dashboard(isDepartmentScoped(currentUser) ? currentUser.departmentId() : null);
        return ResponseEntity.ok(ApiResponse.ok("Resource dashboard loaded", dashboard));
    }

    @GetMapping("/insights")
    public ResponseEntity<ApiResponse<List<ResourceInsightDto>>> getInsights(
            @RequestParam(required = false) String date,
            Authentication authentication) {
        AppUser currentUser = currentUserOrNull(authentication);
        LocalDate targetDate = date == null || date.isBlank() ? LocalDate.now() : LocalDate.parse(date);
        List<ResourceInsightDto> insights = resourceService.insights(targetDate, isDepartmentScoped(currentUser) ? currentUser.departmentId() : null);
        return ResponseEntity.ok(ApiResponse.ok("Resource insights loaded", insights));
    }

    @GetMapping("/schedule")
    public ResponseEntity<ApiResponse<List<ResourceScheduleItemDto>>> getSchedule(
            @RequestParam(required = false) String date,
            Authentication authentication) {
        AppUser currentUser = currentUserOrNull(authentication);
        LocalDate targetDate = date == null || date.isBlank() ? LocalDate.now() : LocalDate.parse(date);
        List<ResourceScheduleItemDto> schedule = resourceService.schedules(targetDate, isDepartmentScoped(currentUser) ? currentUser.departmentId() : null);
        return ResponseEntity.ok(ApiResponse.ok("Resource schedule loaded", schedule));
    }

    @PostMapping("/suggest-best")
    public ResponseEntity<ApiResponse<BestResourceSuggestionDto>> suggestBest(
            @Valid @RequestBody BestResourceSuggestionRequest request,
            Authentication authentication) {
        AppUser currentUser = currentUserOrNull(authentication);
        BestResourceSuggestionDto suggestion = resourceService.suggestBestResource(
                request,
                isDepartmentScoped(currentUser) ? currentUser.departmentId() : null
        );
        return ResponseEntity.ok(ApiResponse.ok("Best resource suggestion generated", suggestion));
    }

    @PostMapping("/classrooms/search")
    public ResponseEntity<ApiResponse<List<ClassroomDto>>> searchClassrooms(@Valid @RequestBody ResourceSearchRequest request) {
        return ResponseEntity.ok(ApiResponse.ok("Classroom matches", resourceService.searchClassrooms(request)));
    }

    @PatchMapping("/classrooms/{id}/status")
    @PreAuthorize("hasAnyRole('COLLEGE_ADMIN','SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<ClassroomDto>> updateClassroomStatus(@PathVariable Long id,
                                                                           @Valid @RequestBody UpdateResourceStatusRequest request,
                                                                           Authentication authentication) {
        ensureDepartmentAccess(currentUser(authentication), resourceService.getResource(id).departmentId());
        return ResponseEntity.ok(ApiResponse.ok("Classroom status updated", resourceService.updateClassroomStatus(id, request.status())));
    }

    @PatchMapping("/laboratories/{id}/status")
    @PreAuthorize("hasAnyRole('COLLEGE_ADMIN','SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<LaboratoryDto>> updateLabStatus(@PathVariable Long id,
                                                                      @Valid @RequestBody UpdateResourceStatusRequest request,
                                                                      Authentication authentication) {
        ensureDepartmentAccess(currentUser(authentication), resourceService.getResource(id).departmentId());
        return ResponseEntity.ok(ApiResponse.ok("Laboratory status updated", resourceService.updateLabStatus(id, request.status())));
    }

    @PatchMapping("/equipment/{id}/status")
    @PreAuthorize("hasAnyRole('COLLEGE_ADMIN','SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<EquipmentDto>> updateEquipmentStatus(@PathVariable Long id,
                                                                           @Valid @RequestBody UpdateResourceStatusRequest request,
                                                                           Authentication authentication) {
        ensureDepartmentAccess(currentUser(authentication), resourceService.getResource(id).departmentId());
        return ResponseEntity.ok(ApiResponse.ok("Equipment status updated", resourceService.updateEquipmentStatus(id, request.status())));
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
