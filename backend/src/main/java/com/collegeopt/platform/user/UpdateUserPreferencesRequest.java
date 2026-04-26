package com.collegeopt.platform.user;

import java.util.Map;

public record UpdateUserPreferencesRequest(
        Boolean emailNotificationsEnabled,
        Boolean announcementAlertsEnabled,
        Boolean aiAlertsEnabled,
        Boolean systemUpdatesEnabled,
        Boolean aiEnabled,
        Boolean animationEnabled,
        Boolean glassEffectEnabled,
        Boolean autoThemeEnabled,
        String predictionLevel,
        String customThemeName,
        String backgroundGradient,
        String cardColor,
        String accentColor,
        String textColor,
        Map<String, Object> roleSettings
) {
}
