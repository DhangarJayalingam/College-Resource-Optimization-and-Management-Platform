package com.collegeopt.platform.campus;

public record DepartmentDetailDto(
        Long id,
        String name,
        String code,
        String description,
        String campus,
        long facultyCount,
        long studentCount,
        long resourceCount
) {
}
