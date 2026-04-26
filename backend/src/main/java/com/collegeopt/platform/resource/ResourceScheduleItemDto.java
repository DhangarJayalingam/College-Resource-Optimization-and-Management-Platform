package com.collegeopt.platform.resource;

import java.time.LocalDate;
import java.time.LocalTime;

public record ResourceScheduleItemDto(
        Long resourceId,
        String resourceName,
        ResourceType resourceType,
        Long departmentId,
        LocalDate bookingDate,
        LocalTime startTime,
        LocalTime endTime,
        String status,
        String source
) {
}
