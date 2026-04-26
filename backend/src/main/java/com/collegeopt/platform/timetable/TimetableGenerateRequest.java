package com.collegeopt.platform.timetable;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

import java.util.List;
import java.util.Set;

public record TimetableGenerateRequest(
        @NotBlank String termName,
        @NotNull List<SectionRequirement> sections
) {
    public record SectionRequirement(
            @NotBlank String courseCode,
            @NotBlank String sectionCode,
            @NotNull Integer expectedStudents,
            @NotNull Set<String> requiredTags,
            TimetableEntryType type,
            @Min(1) Integer duration
    ) {
    }
}
