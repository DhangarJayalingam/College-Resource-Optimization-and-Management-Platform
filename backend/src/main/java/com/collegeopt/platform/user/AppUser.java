package com.collegeopt.platform.user;

import java.util.Set;

public record AppUser(
        Long id,
        Long tenantId,
        Long campusId,
        Long departmentId,
        String fullName,
        String email,
        String passwordHash,
        Set<RoleType> roles,
        Long sessionVersion
) {
}
