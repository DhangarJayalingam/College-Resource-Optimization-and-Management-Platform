package com.collegeopt.platform.user;

import com.collegeopt.platform.activity.ActivityLogDto;

import java.util.List;
import java.util.Set;

public record UserSettingsDto(
        Long id,
        String fullName,
        String email,
        Long departmentId,
        String departmentName,
        Set<RoleType> roles,
        UserPreferences preferences,
        List<ActivityLogDto> activityLogs
) {
}
