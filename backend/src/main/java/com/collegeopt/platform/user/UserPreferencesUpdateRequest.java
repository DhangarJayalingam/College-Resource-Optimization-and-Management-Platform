package com.collegeopt.platform.user;

public record UserPreferencesUpdateRequest(
        Boolean notificationsEnabled,
        Boolean emailNotifications,
        Boolean announcementAlerts,
        Boolean aiAlerts,
        Boolean systemUpdates,
        Boolean aiEnabled,
        String predictionLevel,
        Boolean aiAlertNotifications,
        Boolean animationEnabled,
        Boolean glassEffectEnabled,
        Boolean autoThemeEnabled,
        Boolean dashboardCompactView,
        String timetablePreference,
        String resourcePreference,
        String departmentRules,
        String systemConfiguration,
        String customThemeName,
        String customBackground,
        String customCardColor,
        String customAccentColor,
        String customTextColor
) {
}
