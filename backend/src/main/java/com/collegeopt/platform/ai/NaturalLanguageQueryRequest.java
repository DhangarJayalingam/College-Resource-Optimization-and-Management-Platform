package com.collegeopt.platform.ai;

import jakarta.validation.constraints.NotBlank;

public record NaturalLanguageQueryRequest(@NotBlank String query) {
}
