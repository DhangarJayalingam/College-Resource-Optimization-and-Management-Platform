package com.collegeopt.platform.ai;

public record AiRecommendationDto(
        String title,
        String summary,
        String action,
        String priority
) {
}
