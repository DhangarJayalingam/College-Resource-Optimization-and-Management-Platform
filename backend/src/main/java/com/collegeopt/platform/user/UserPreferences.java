package com.collegeopt.platform.user;

import java.util.Map;

public record UserPreferences(
        Long userId,
        String theme,
        boolean emailNotificationsEnabled,
        boolean announcementAlertsEnabled,
        boolean aiAlertsEnabled,
        boolean systemUpdatesEnabled,
        boolean aiEnabled,
        boolean animationEnabled,
        boolean glassEffectEnabled,
        boolean autoThemeEnabled,
        String predictionLevel,
        String profileImageUrl,
        String customThemeName,
        String backgroundGradient,
        String cardColor,
        String accentColor,
        String textColor,
        Map<String, Object> roleSettings
) {
}
