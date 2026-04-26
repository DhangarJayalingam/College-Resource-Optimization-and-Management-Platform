package com.collegeopt.platform.booking;

public record BookingRecommendationDto(
        Long resourceId,
        String resourceName,
        String resourceType,
        String building,
        String suggestedStartTime,
        String suggestedEndTime,
        String reason
) {
}
