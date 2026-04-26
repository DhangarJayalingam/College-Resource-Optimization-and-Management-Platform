package com.collegeopt.platform.campus;

import java.time.LocalDateTime;

public record StudyMaterialDto(
        Long id,
        String courseCode,
        String title,
        String description,
        String fileUrl,
        Long facultyId,
        Long departmentId,
        LocalDateTime uploadedAt
) {
}
