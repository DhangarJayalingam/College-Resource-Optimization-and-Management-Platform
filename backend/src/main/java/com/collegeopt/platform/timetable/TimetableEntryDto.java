package com.collegeopt.platform.timetable;

import java.time.LocalTime;

public record TimetableEntryDto(
        Long id,
        String courseCode,
        String academicLevel,
        String sectionCode,
        Long facultyUserId,
        String facultyName,
        Long departmentId,
        Long resourceId,
        String resourceName,
        String dayOfWeek,
        LocalTime startTime,
        LocalTime endTime,
        int duration,
        TimetableEntryType type,
        Long classroomId,
        Long laboratoryId,
        boolean generatedByAi
) {
}
