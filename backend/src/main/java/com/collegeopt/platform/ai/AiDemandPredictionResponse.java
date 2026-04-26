package com.collegeopt.platform.ai;

public record AiDemandPredictionResponse(
        String resourceType,
        double nextWeekPredictedUtilization,
        int recommendedAdditionalUnits,
        String insight
) {
}
