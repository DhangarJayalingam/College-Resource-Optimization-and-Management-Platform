package com.collegeopt.platform.ai;

import java.util.List;

public record AiPanelResponse<T>(
        String role,
        String scope,
        List<T> items,
        List<String> samplePrompts
) {
}
