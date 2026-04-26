package com.collegeopt.platform.admin;

import java.util.Map;

public record OperationalDataResetResult(
        String scope,
        String mode,
        Long departmentId,
        Map<String, Integer> deletedCounts
) {
}
