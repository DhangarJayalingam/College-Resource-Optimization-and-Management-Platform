package com.collegeopt.platform.campus;

public record DepartmentDto(
                Long id,
                Long campusId,
                String code,
                String name,
                String description) {
}
