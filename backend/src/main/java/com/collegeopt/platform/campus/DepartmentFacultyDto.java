package com.collegeopt.platform.campus;

import java.util.List;

public record DepartmentFacultyDto(
        Long id,
        String name,
        String email,
        List<String> subjects
) {
}
