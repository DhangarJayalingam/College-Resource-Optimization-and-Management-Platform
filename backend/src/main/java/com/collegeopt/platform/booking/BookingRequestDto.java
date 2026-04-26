package com.collegeopt.platform.booking;

import com.collegeopt.platform.resource.ResourceType;
import jakarta.validation.constraints.FutureOrPresent;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;
import java.time.LocalTime;

public record BookingRequestDto(
        @NotNull Long resourceId,
        @NotNull ResourceType resourceType,
        @NotNull @FutureOrPresent LocalDate date,
        @NotNull LocalTime startTime,
        @NotNull LocalTime endTime,
        @NotBlank String purpose,
        String remarks,
        @Min(1) Integer expectedCapacity,
        boolean recurring,
        String recurringPattern,
        boolean priorityOverride
) {
}
