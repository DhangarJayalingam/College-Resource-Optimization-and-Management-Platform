package com.collegeopt.platform.booking;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;

public record BookingDto(
        Long id,
        Long userId,
        String userName,
        Long resourceId,
        String resourceName,
        String resourceType,
        LocalDate date,
        LocalTime startTime,
        LocalTime endTime,
        String purpose,
        BookingStatus status,
        Long approvedBy,
        LocalDateTime approvedAt,
        String remarks,
        BookingPriority priority,
        boolean requiresApproval,
        ApprovalStage currentApprovalStage,
        String recurringPattern,
        List<BookingApprovalHistoryDto> approvalHistory,
        LocalDateTime createdAt,
        LocalDateTime updatedAt
) {
}
