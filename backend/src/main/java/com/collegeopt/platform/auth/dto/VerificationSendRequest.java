package com.collegeopt.platform.auth.dto;

import com.collegeopt.platform.auth.VerificationPurpose;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record VerificationSendRequest(
        @NotBlank @Email String email,
        String fullName,
        @NotNull VerificationPurpose purpose
) {
}
