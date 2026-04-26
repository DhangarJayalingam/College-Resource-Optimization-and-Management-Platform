package com.collegeopt.platform.ai;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.util.Set;

public record AiResourceRecommendationRequest(
        @NotBlank String resourceType,
        @NotNull @Min(1) Integer expectedUsers,
        @NotNull Set<String> requiredTags
) {
}
