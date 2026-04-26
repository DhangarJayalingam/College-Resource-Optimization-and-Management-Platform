package com.collegeopt.platform.timetable;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

import java.time.LocalTime;

public record UpsertTimetableEntryRequest(
        @NotBlank String course,
        @NotBlank String academicLevel,
        @NotBlank String sectionCode,
        @NotBlank String faculty,
        @NotNull Long resourceId,
        @NotBlank String resourceType,
        @NotNull TimetableEntryType type,
        @NotNull @Min(1) Integer duration,
        @NotBlank String dayOfWeek,
        @NotNull LocalTime startTime,
        @NotNull LocalTime endTime
) {
}
