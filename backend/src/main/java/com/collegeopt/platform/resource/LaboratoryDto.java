package com.collegeopt.platform.resource;

import java.util.Set;

public record LaboratoryDto(
        Long id,
        String labCode,
        String labType,
        int capacity,
        Set<String> tags,
        ResourceStatus status
) {
}
