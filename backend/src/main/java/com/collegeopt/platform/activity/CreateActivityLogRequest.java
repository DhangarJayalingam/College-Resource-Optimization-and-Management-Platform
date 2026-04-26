package com.collegeopt.platform.activity;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.util.Map;

public record CreateActivityLogRequest(
        @NotNull Long userId,
        @NotBlank String action,
        @NotBlank String entityType,
        @NotNull Long entityId,
        Map<String, Object> details
) {
}
