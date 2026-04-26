package com.collegeopt.platform.analytics;

import java.util.List;
import java.util.Map;

public record DashboardAnalyticsDto(
        double resourceUtilizationRate,
        List<Map<String, Object>> classroomOccupancy,
        Map<String, Long> facultyWorkload,
        Map<String, Long> weeklyHeatmap,
        List<Map<String, Object>> idleResources,
        List<Map<String, Object>> departmentUsage
) {
}
