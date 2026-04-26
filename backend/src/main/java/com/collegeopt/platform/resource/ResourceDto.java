package com.collegeopt.platform.resource;

import java.time.LocalDate;
import java.util.Set;

public record ResourceDto(
        Long id,
        String name,
        ResourceType type,
        int capacity,
        String building,
        Long departmentId,
        Set<String> tags,
        ResourceStatus status,
        Long assignedLabId,
        LocalDate lastMaintenanceDate
) {
}
