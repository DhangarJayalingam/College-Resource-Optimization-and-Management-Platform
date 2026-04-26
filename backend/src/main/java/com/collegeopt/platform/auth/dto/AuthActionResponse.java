package com.collegeopt.platform.auth.dto;

public record AuthActionResponse(
        String action,
        String status,
        String message
) {
}
