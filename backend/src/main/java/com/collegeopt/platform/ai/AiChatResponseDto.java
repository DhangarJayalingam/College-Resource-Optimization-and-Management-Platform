package com.collegeopt.platform.ai;

import java.util.List;

public record AiChatResponseDto(
        String role,
        String scope,
        String answer,
        List<String> followUps,
        List<String> sourceModules
) {
}
