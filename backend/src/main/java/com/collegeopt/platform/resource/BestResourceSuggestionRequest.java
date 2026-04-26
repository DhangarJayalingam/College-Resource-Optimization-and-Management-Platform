package com.collegeopt.platform.resource;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

public record BestResourceSuggestionRequest(
        @NotNull ResourceType resourceType,
        @NotNull @Min(1) Integer capacity,
        Long departmentId,
        String building,
        String equipment
) {
}
