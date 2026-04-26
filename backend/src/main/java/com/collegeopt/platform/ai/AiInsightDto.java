package com.collegeopt.platform.ai;

public record AiInsightDto(
        String title,
        String summary,
        String metric,
        String severity
) {
}
