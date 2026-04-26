package com.collegeopt.platform.resource;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.Set;

public record ResourceSearchRequest(
        @NotNull @Min(1) Integer capacity,
        @NotNull Set<String> requiredTags,
        @NotNull LocalDate date,
        @NotNull LocalTime startTime,
        @NotNull LocalTime endTime
) {
}
