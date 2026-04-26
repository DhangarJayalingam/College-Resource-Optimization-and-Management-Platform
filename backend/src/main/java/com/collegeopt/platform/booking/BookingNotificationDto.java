package com.collegeopt.platform.booking;

import java.time.LocalDateTime;

public record BookingNotificationDto(
        Long id,
        Long userId,
        String title,
        String message,
        String type,
        LocalDateTime createdAt
) {
}
