package com.collegeopt.platform.booking;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;
import java.time.LocalTime;

public record ResourceRequestCreateRequest(
        @NotBlank String requestType,
        @NotNull Long requesterUserId,
        @NotNull Long resourceId,
        @NotNull LocalDate date,
        @NotNull LocalTime startTime,
        @NotNull LocalTime endTime,
        @NotBlank String reason
) {
}
