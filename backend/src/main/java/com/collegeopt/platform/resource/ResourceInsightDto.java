package com.collegeopt.platform.resource;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.Set;

public record ResourceInsightDto(
        Long id,
        String name,
        ResourceType type,
        int capacity,
        String building,
        Long departmentId,
        Set<String> tags,
        String smartStatus,
        int utilizationPercent,
        String usageLevel,
        boolean maintenanceAlert,
        String maintenanceStatus,
        LocalDate lastMaintenanceDate,
        LocalDate nextBookingDate,
        LocalTime nextBookingStartTime,
        LocalTime nextBookingEndTime,
        long activeBookings
) {
}
