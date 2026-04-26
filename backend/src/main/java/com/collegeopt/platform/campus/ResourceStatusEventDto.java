package com.collegeopt.platform.campus;

import java.time.LocalDateTime;

public record ResourceStatusEventDto(
                Long resourceId,
                String resourceName,
                String previousStatus,
                String currentStatus,
                String context,
                LocalDateTime occurredAt) {
}
