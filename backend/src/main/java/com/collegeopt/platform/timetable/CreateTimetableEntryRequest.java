package com.collegeopt.platform.timetable;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

import java.time.LocalTime;

public record CreateTimetableEntryRequest(
        @NotBlank String courseCode,
        @NotBlank String sectionCode,
        @NotNull Long facultyUserId,
        @NotBlank String facultyName,
        @NotNull TimetableEntryType type,
        @NotNull @Min(1) Integer duration,
        @NotBlank String dayOfWeek,
        @NotNull LocalTime startTime,
        @NotNull LocalTime endTime,
        Long classroomId,
        Long laboratoryId
) {
}
