package com.collegeopt.platform.campus;

import java.util.List;

public record DepartmentStudentDto(
        Long id,
        String name,
        String email,
        String pnrNo,
        String rollNo,
        String yearSemester,
        List<String> courses
) {
}
