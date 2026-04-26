package com.collegeopt.platform.auth.dto;

public record LogoutAllSessionsRequest(
        boolean includeCurrentSession
) {
}
