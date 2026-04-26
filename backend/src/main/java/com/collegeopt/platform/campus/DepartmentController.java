package com.collegeopt.platform.campus;

import com.collegeopt.platform.common.ApiResponse;
import com.collegeopt.platform.user.AppUser;
import com.collegeopt.platform.user.RoleType;
import com.collegeopt.platform.user.UserDirectoryService;
import jakarta.validation.Valid;
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

import java.util.List;
import java.util.Objects;

@RestController
@RequestMapping("/api/v1/departments")
public class DepartmentController {

    private final DepartmentService departmentService;
    private final UserDirectoryService userDirectoryService;

    public DepartmentController(DepartmentService departmentService, UserDirectoryService userDirectoryService) {
        this.departmentService = departmentService;
        this.userDirectoryService = userDirectoryService;
    }

    @GetMapping
    public ResponseEntity<ApiResponse<List<DepartmentDto>>> listAll(Authentication authentication) {
        AppUser currentUser = currentUserOrNull(authentication);
        List<DepartmentDto> departments = isDepartmentScoped(currentUser)
                ? List.of(departmentService.getById(currentUser.departmentId()))
                : departmentService.listAll();
        return ResponseEntity.ok(ApiResponse.ok("Departments loaded", departments));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<DepartmentDetailDto>> getById(@PathVariable Long id, Authentication authentication) {
        ensureDepartmentAccess(currentUserOrNull(authentication), id);
        return ResponseEntity.ok(ApiResponse.ok("Department loaded", departmentService.getDetailById(id)));
    }

    @GetMapping("/{id}/faculty")
    public ResponseEntity<ApiResponse<List<DepartmentFacultyDto>>> getFaculty(@PathVariable Long id, Authentication authentication) {
        ensureDepartmentAccess(currentUserOrNull(authentication), id);
        return ResponseEntity.ok(ApiResponse.ok("Department faculty loaded", departmentService.getFaculty(id)));
    }

    @GetMapping("/{id}/students")
    public ResponseEntity<ApiResponse<List<DepartmentStudentDto>>> getStudents(@PathVariable Long id, Authentication authentication) {
        ensureDepartmentAccess(currentUserOrNull(authentication), id);
        return ResponseEntity.ok(ApiResponse.ok("Department students loaded", departmentService.getStudents(id)));
    }

    @GetMapping("/{id}/resources")
    public ResponseEntity<ApiResponse<List<com.collegeopt.platform.resource.ResourceDto>>> getResources(@PathVariable Long id, Authentication authentication) {
        ensureDepartmentAccess(currentUserOrNull(authentication), id);
        return ResponseEntity.ok(ApiResponse.ok("Department resources loaded", departmentService.getResources(id)));
    }

    @GetMapping("/{id}/timetable")
    public ResponseEntity<ApiResponse<List<com.collegeopt.platform.timetable.TimetableEntryDto>>> getTimetable(@PathVariable Long id, Authentication authentication) {
        ensureDepartmentAccess(currentUserOrNull(authentication), id);
        return ResponseEntity.ok(ApiResponse.ok("Department timetable loaded", departmentService.getTimetable(id)));
    }

    @GetMapping("/{id}/announcements")
    public ResponseEntity<ApiResponse<List<AnnouncementDto>>> getAnnouncements(@PathVariable Long id, Authentication authentication) {
        AppUser currentUser = currentUser(authentication);
        ensureDepartmentAccess(currentUser, id);
        return ResponseEntity.ok(ApiResponse.ok("Department announcements loaded", departmentService.getAnnouncements(id, currentUser)));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('COLLEGE_ADMIN','SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<DepartmentDto>> create(@Valid @RequestBody DepartmentDto request, Authentication authentication) {
        if (isDepartmentScoped(currentUser(authentication))) {
            throw new IllegalArgumentException("Only super admin can create departments");
        }
        return ResponseEntity.ok(ApiResponse.ok("Department created", departmentService.create(request)));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('COLLEGE_ADMIN','SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<DepartmentDto>> update(@PathVariable Long id,
                                                             @Valid @RequestBody DepartmentDto request,
                                                             Authentication authentication) {
        ensureDepartmentAccess(currentUser(authentication), id);
        return ResponseEntity.ok(ApiResponse.ok("Department updated", departmentService.update(id, request)));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('COLLEGE_ADMIN','SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<String>> delete(@PathVariable Long id, Authentication authentication) {
        if (isDepartmentScoped(currentUser(authentication))) {
            throw new IllegalArgumentException("Only super admin can delete departments");
        }
        departmentService.delete(id);
        return ResponseEntity.ok(ApiResponse.ok("Department deleted", "Deleted successfully"));
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
