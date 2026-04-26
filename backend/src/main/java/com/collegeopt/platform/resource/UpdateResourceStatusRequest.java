package com.collegeopt.platform.resource;

import jakarta.validation.constraints.NotNull;

public record UpdateResourceStatusRequest(@NotNull ResourceStatus status) {
}
