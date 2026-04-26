package com.collegeopt.platform.campus;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record CreateAnnouncementRequest(
                @NotBlank String title,
                @NotBlank String content,
                @NotBlank String audience,
                @NotNull Long createdByUserId,
                Long departmentId,
                String recipientEmail,
                String attachmentUrl,
                String attachmentType,
                String fileName) {
}
