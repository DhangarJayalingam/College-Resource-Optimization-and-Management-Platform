package com.collegeopt.platform.booking;

import java.util.List;
import java.util.Map;

public record BookingAnalyticsDto(
        long totalBookings,
        long pendingBookings,
        long approvedBookings,
        long completedBookings,
        long cancelledBookings,
        List<Map<String, Object>> resourceUsage,
        List<Map<String, Object>> peakHours,
        List<Map<String, Object>> bookingTrends
) {
}
