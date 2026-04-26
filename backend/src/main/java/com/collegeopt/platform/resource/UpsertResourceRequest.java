package com.collegeopt.platform.resource;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;
import java.util.Set;

public record UpsertResourceRequest(
        @NotBlank String name,
        @NotNull ResourceType type,
        @NotNull @Min(0) Integer capacity,
        @NotBlank String building,
        @NotNull Long departmentId,
        @NotNull Set<String> tags,
        @NotNull ResourceStatus status,
        Long assignedLabId,
        LocalDate lastMaintenanceDate
) {
}
