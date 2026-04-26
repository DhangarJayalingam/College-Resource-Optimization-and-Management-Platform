package com.collegeopt.platform.user;

public record ProfileUpdateResponse(
        UserSettingsProfile profile,
        boolean requiresReauthentication
) {
}
