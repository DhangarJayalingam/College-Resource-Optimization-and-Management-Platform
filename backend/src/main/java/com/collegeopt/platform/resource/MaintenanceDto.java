package com.collegeopt.platform.resource;

import java.time.LocalDate;

public record MaintenanceDto(
        Long id,
        Long resourceId,
        Long equipmentId,
        Long reportedBy,
        String issueDescription,
        String status,
        LocalDate scheduledDate,
        LocalDate completedDate
) {
}
