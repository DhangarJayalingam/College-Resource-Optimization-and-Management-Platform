package com.collegeopt.platform.user;

import com.collegeopt.platform.campus.AnnouncementDto;
import com.collegeopt.platform.campus.AnnouncementService;
import com.collegeopt.platform.campus.StudyMaterialDto;
import com.collegeopt.platform.campus.StudyMaterialService;
import com.collegeopt.platform.common.ApiResponse;
import com.collegeopt.platform.timetable.TimetableEntryDto;
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
@RequestMapping("/api/v1/students")
@PreAuthorize("hasAnyRole('STUDENT','FACULTY','COLLEGE_ADMIN','SUPER_ADMIN')")
public class StudentPortalController {

    private final TimetableService timetableService;
    private final AnnouncementService announcementService;
    private final StudyMaterialService studyMaterialService;
    private final UserDirectoryService userDirectoryService;

    public StudentPortalController(TimetableService timetableService,
                                   AnnouncementService announcementService,
                                   StudyMaterialService studyMaterialService,
                                   UserDirectoryService userDirectoryService) {
        this.timetableService = timetableService;
        this.announcementService = announcementService;
        this.studyMaterialService = studyMaterialService;
        this.userDirectoryService = userDirectoryService;
    }

    @GetMapping("/timetable")
    public ResponseEntity<ApiResponse<List<TimetableEntryDto>>> timetable() {
        return ResponseEntity.ok(ApiResponse.ok("Student timetable", timetableService.listEntries()));
    }

    @GetMapping("/classroom-locations")
    public ResponseEntity<ApiResponse<List<Map<String, Object>>>> classroomLocations() {
        List<Map<String, Object>> locations = List.of(
                Map.of("roomCode", "A-101", "building", "Academic Block A", "floor", 1),
                Map.of("roomCode", "A-204", "building", "Academic Block A", "floor", 2),
                Map.of("roomCode", "C-010", "building", "Central Block", "floor", 0)
        );
        return ResponseEntity.ok(ApiResponse.ok("Classroom locations", locations));
    }

    @GetMapping("/announcements")
    public ResponseEntity<ApiResponse<List<AnnouncementDto>>> announcements(Authentication authentication) {
        AppUser currentUser = userDirectoryService.findByEmail(authentication.getName()).orElseThrow();
        return ResponseEntity.ok(ApiResponse.ok("Student announcements", announcementService.listAnnouncementsForUser(currentUser)));
    }

    @GetMapping("/materials")
    public ResponseEntity<ApiResponse<List<StudyMaterialDto>>> materials() {
        return ResponseEntity.ok(ApiResponse.ok("Student study materials", studyMaterialService.listMaterials()));
    }
}
