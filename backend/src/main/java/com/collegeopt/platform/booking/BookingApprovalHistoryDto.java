package com.collegeopt.platform.booking;

import java.time.LocalDateTime;

public record BookingApprovalHistoryDto(
        Long id,
        Long bookingId,
        ApprovalStage stage,
        String action,
        Long actorUserId,
        String actorName,
        String remarks,
        LocalDateTime actionAt
) {
}
