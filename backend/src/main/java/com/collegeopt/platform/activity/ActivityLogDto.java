package com.collegeopt.platform.activity;

import java.time.LocalDateTime;
import java.util.Map;

public record ActivityLogDto(
        Long id,
        Long userId,
        String action,
        String entityType,
        Long entityId,
        Map<String, Object> details,
        LocalDateTime createdAt
) {
}
