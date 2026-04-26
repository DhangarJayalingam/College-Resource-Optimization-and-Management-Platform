package com.collegeopt.platform.auth.dto;

import com.collegeopt.platform.auth.VerificationPurpose;

public record VerificationSendResponse(
        String email,
        VerificationPurpose purpose,
        int expiresInMinutes,
        String message,
        String demoCode
) {
}
