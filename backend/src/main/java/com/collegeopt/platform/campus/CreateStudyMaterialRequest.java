package com.collegeopt.platform.campus;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record CreateStudyMaterialRequest(
        @NotBlank String courseCode,
        @NotBlank String title,
        @NotBlank String description,
        @NotBlank String fileUrl,
        @NotNull Long facultyId,
        @NotNull Long departmentId
) {
}
