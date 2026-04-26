package com.collegeopt.platform.user;

import java.util.Set;

public record UserSettingsProfile(
        Long userId,
        String fullName,
        String email,
        Long departmentId,
        String departmentName,
        Set<RoleType> roles,
        String profileImageUrl
) {
}
