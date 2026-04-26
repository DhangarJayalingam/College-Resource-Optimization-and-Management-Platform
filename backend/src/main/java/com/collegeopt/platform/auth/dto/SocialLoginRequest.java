package com.collegeopt.platform.auth.dto;

import com.collegeopt.platform.auth.SocialProvider;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record SocialLoginRequest(
        @NotNull SocialProvider provider,
        @NotBlank @Email String email,
        @NotBlank String fullName
) {
}
