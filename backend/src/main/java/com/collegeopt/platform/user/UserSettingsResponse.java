package com.collegeopt.platform.user;

public record UserSettingsResponse(
        UserSettingsProfile profile,
        UserPreferences preferences
) {
}
