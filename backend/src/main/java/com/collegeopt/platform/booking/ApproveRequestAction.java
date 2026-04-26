package com.collegeopt.platform.booking;

import jakarta.validation.constraints.NotNull;

public record ApproveRequestAction(
        @NotNull Long approverUserId,
        String comments
) {
}
