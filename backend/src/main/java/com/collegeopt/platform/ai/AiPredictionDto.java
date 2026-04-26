package com.collegeopt.platform.ai;

public record AiPredictionDto(
        String title,
        String summary,
        String predictedValue,
        String confidence
) {
}
