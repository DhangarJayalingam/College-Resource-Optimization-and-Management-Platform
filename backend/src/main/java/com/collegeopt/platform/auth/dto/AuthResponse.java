package com.collegeopt.platform.auth.dto;

import com.collegeopt.platform.user.RoleType;

import java.util.Set;

public record AuthResponse(
        String token,
        String email,
        String fullName,
        Set<RoleType> roles
) {
}
