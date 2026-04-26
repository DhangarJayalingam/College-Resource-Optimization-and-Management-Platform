package com.collegeopt.platform.user;

public record UserThemeUpdateRequest(
        String theme,
        Boolean animationEnabled,
        Boolean glassEffectEnabled,
        Boolean autoThemeEnabled,
        String customThemeName,
        String customBackground,
        String customCardColor,
        String customAccentColor,
        String customTextColor
) {
}
