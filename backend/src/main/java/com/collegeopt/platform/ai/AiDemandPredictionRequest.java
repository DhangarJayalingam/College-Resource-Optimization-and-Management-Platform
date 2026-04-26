package com.collegeopt.platform.ai;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.util.List;

public record AiDemandPredictionRequest(
        @NotBlank String resourceType,
        @NotNull List<Integer> recentUtilizationPercentages,
        @NotNull Integer currentInventory
) {
}
