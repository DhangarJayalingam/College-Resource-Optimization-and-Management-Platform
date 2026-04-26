package com.collegeopt.platform.user;

import com.collegeopt.platform.booking.BookingService;
import com.collegeopt.platform.booking.ResourceRequestCreateRequest;
import com.collegeopt.platform.booking.ResourceRequestDto;
import com.collegeopt.platform.campus.StudyMaterialDto;
import com.collegeopt.platform.campus.StudyMaterialService;
import com.collegeopt.platform.common.ApiResponse;
import com.collegeopt.platform.resource.ResourceService;
import com.collegeopt.platform.timetable.TimetableEntryDto;
import com.collegeopt.platform.timetable.TimetableService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/v1/faculty")
@PreAuthorize("hasAnyRole('FACULTY','COLLEGE_ADMIN','SUPER_ADMIN')")
public class FacultyPortalController {

    private final TimetableService timetableService;
    private final BookingService bookingService;
    private final ResourceService resourceService;
    private final StudyMaterialService studyMaterialService;
    private final UserDirectoryService userDirectoryService;

    public FacultyPortalController(TimetableService timetableService,
                                   BookingService bookingService,
                                   ResourceService resourceService,
                                   StudyMaterialService studyMaterialService,
                                   UserDirectoryService userDirectoryService) {
        this.timetableService = timetableService;
        this.bookingService = bookingService;
        this.resourceService = resourceService;
        this.studyMaterialService = studyMaterialService;
        this.userDirectoryService = userDirectoryService;
    }

    @GetMapping("/timetable")
    public ResponseEntity<ApiResponse<List<TimetableEntryDto>>> myTimetable(Authentication authentication) {
        String email = authentication.getName();
        Long userId = userDirectoryService.findByEmail(email).map(AppUser::id).orElse(3L);
        List<TimetableEntryDto> filtered = timetableService.listEntries().stream()
                .filter(entry -> entry.facultyUserId().equals(userId))
                .toList();
        return ResponseEntity.ok(ApiResponse.ok("Faculty timetable", filtered));
    }

    @PostMapping("/requests")
    public ResponseEntity<ApiResponse<ResourceRequestDto>> requestResource(@Valid @RequestBody ResourceRequestCreateRequest request) {
        return ResponseEntity.ok(ApiResponse.ok("Resource request submitted", bookingService.createRequest(request)));
    }

    @GetMapping("/resource-availability")
    public ResponseEntity<ApiResponse<?>> resourceAvailability() {
        return ResponseEntity.ok(ApiResponse.ok("Resource availability", resourceService.resourceUtilizationSummary()));
    }

    @GetMapping("/materials")
    public ResponseEntity<ApiResponse<List<StudyMaterialDto>>> materials() {
        return ResponseEntity.ok(ApiResponse.ok("Study materials", studyMaterialService.listMaterials()));
    }
}
