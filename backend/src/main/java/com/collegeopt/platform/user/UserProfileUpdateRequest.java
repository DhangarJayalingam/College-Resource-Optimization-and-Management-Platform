package com.collegeopt.platform.user;

public record UserProfileUpdateRequest(
        String fullName,
        String email,
        Long departmentId
) {
}
