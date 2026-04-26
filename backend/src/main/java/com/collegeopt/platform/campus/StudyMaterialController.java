package com.collegeopt.platform.campus;

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
@RequestMapping("/api/v1/materials")
public class StudyMaterialController {

    private final StudyMaterialService studyMaterialService;

    public StudyMaterialController(StudyMaterialService studyMaterialService) {
        this.studyMaterialService = studyMaterialService;
    }

    @GetMapping
    public ResponseEntity<ApiResponse<List<StudyMaterialDto>>> listMaterials() {
        return ResponseEntity.ok(ApiResponse.ok("Study materials loaded", studyMaterialService.listMaterials()));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('FACULTY','COLLEGE_ADMIN','SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<StudyMaterialDto>> uploadMaterial(@Valid @RequestBody CreateStudyMaterialRequest request) {
        return ResponseEntity.ok(ApiResponse.ok("Study material uploaded", studyMaterialService.upload(request)));
    }
}
