package com.collegeopt.platform.auth.dto;

import com.collegeopt.platform.user.RoleType;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.Set;

public record RegisterRequest(
        @NotBlank String fullName,
        @NotBlank @Email String email,
        @NotBlank @Size(min = 8) String password,
        @NotNull Set<RoleType> roles,
        @NotNull Long tenantId,
        @NotNull Long campusId
) {
}
