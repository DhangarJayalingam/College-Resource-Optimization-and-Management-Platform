package com.collegeopt.platform.resource;

import java.util.List;

public record ResourceDashboardDto(
        int utilizationPercent,
        long activeBookings,
        String mostUsedResource,
        List<String> underusedResources
) {
}
