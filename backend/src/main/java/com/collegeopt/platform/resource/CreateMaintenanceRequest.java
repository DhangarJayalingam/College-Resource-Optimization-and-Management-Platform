package com.collegeopt.platform.resource;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;

public record CreateMaintenanceRequest(
        Long resourceId,
        Long equipmentId,
        @NotNull Long reportedBy,
        @NotBlank String issueDescription,
        @NotBlank String status,
        @NotNull LocalDate scheduledDate,
        LocalDate completedDate
) {
}
