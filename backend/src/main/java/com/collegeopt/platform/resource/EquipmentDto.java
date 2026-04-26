package com.collegeopt.platform.resource;

public record EquipmentDto(
        Long id,
        String assetTag,
        String assetName,
        String category,
        ResourceStatus status,
        Long assignedLabId
) {
}
