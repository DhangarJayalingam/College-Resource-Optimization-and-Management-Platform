package com.collegeopt.platform.ai;

import jakarta.validation.constraints.NotBlank;

public record AiAssistantQueryRequest(
        @NotBlank(message = "Query is required")
        String query
) {
}
