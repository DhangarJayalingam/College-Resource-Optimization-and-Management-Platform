package com.collegeopt.platform.ai;

import java.util.Map;

public record AiResourceRecommendationResponse(
        String recommendationType,
        Map<String, Object> resource,
        double score,
        String explanation
) {
}
