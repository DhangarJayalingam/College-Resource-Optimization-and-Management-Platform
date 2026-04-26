package com.collegeopt.platform.booking;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;

public record FacilityBookingDto(
        Long id,
        Long requestId,
        Long bookedByUserId,
        String resourceType,
        Long resourceId,
        LocalDate bookingDate,
        LocalTime startTime,
        LocalTime endTime,
        String status,
        LocalDateTime createdAt
) {
}
