package com.collegeopt.platform.user;

import jakarta.validation.constraints.NotBlank;

public record UpdateThemeRequest(
        @NotBlank String theme,
        String customThemeName,
        String backgroundGradient,
        String cardColor,
        String accentColor,
        String textColor,
        Boolean animationEnabled,
        Boolean glassEffectEnabled,
        Boolean autoThemeEnabled
) {
}
