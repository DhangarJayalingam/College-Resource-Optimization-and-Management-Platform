package com.collegeopt.platform.resource;

public record BestResourceSuggestionDto(
        String recommendationType,
        Long resourceId,
        String resourceName,
        ResourceType resourceType,
        String building,
        Long departmentId,
        int score,
        String explanation
) {
}
