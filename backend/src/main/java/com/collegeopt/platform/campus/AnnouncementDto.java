package com.collegeopt.platform.campus;

import java.time.LocalDateTime;

public record AnnouncementDto(
                Long id,
                String title,
                String content,
                String audience,
                Long createdByUserId,
                Long departmentId,
                String recipientEmail,
                String emailDeliveryStatus,
                LocalDateTime publishedAt,
                String attachmentUrl,
                String attachmentType,
                String fileName) {
}
