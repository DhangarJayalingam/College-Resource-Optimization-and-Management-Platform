package com.collegeopt.platform.booking;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;

public record ResourceRequestDto(
        Long id,
        String requestType,
        Long requesterUserId,
        Long resourceId,
        LocalDate requestedDate,
        LocalTime startTime,
        LocalTime endTime,
        String reason,
        String status,
        Long approvedByUserId,
        LocalDateTime approvedAt
) {
}
