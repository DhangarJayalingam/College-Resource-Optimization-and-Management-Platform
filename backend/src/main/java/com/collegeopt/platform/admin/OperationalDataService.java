package com.collegeopt.platform.admin;

import com.collegeopt.platform.user.AppUser;
import com.collegeopt.platform.user.RoleType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;

@Service
public class OperationalDataService {

    private final JdbcTemplate jdbcTemplate;

    public OperationalDataService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @Transactional
    public OperationalDataResetResult clearOperationalData(AppUser currentUser, String requestedMode) {
        String mode = normalizeMode(requestedMode);
        if (currentUser.roles().contains(RoleType.SUPER_ADMIN)) {
            return clearGlobal(mode);
        }
        if (currentUser.roles().contains(RoleType.COLLEGE_ADMIN)) {
            return clearDepartment(currentUser.departmentId(), mode);
        }
        throw new IllegalArgumentException("Access denied");
    }

    private OperationalDataResetResult clearGlobal(String mode) {
        Map<String, Integer> deletedCounts = new LinkedHashMap<>();
        switch (mode) {
            case "ANNOUNCEMENTS" -> deletedCounts.put("announcements", deleteAll("app_announcements"));
            case "TIMETABLE" -> deletedCounts.put("timetableEntries", deleteAll("app_timetable_entries"));
            case "RESOURCES" -> populateGlobalResourceDeletionCounts(deletedCounts);
            case "ALL" -> {
                populateGlobalResourceDeletionCounts(deletedCounts);
                deletedCounts.put("timetableEntries", deleteAll("app_timetable_entries"));
                deletedCounts.put("announcements", deleteAll("app_announcements"));
            }
            default -> throw new IllegalArgumentException("Unsupported clear mode: " + mode);
        }
        return new OperationalDataResetResult("GLOBAL", mode, null, deletedCounts);
    }

    private OperationalDataResetResult clearDepartment(Long departmentId, String mode) {
        if (departmentId == null) {
            throw new IllegalArgumentException("Department-scoped admin does not have an assigned department.");
        }
        Map<String, Integer> deletedCounts = new LinkedHashMap<>();
        switch (mode) {
            case "ANNOUNCEMENTS" -> deletedCounts.put("announcements", deleteByDepartmentResources(
                    "DELETE FROM app_announcements WHERE department_id = ?",
                    departmentId));
            case "TIMETABLE" -> deletedCounts.put("timetableEntries", deleteByDepartmentResources(
                    "DELETE FROM app_timetable_entries WHERE department_id = ?",
                    departmentId));
            case "RESOURCES" -> populateDepartmentResourceDeletionCounts(deletedCounts, departmentId);
            case "ALL" -> {
                populateDepartmentResourceDeletionCounts(deletedCounts, departmentId);
                deletedCounts.put("timetableEntries", deleteByDepartmentResources(
                        "DELETE FROM app_timetable_entries WHERE department_id = ?",
                        departmentId));
                deletedCounts.put("announcements", deleteByDepartmentResources(
                        "DELETE FROM app_announcements WHERE department_id = ?",
                        departmentId));
            }
            default -> throw new IllegalArgumentException("Unsupported clear mode: " + mode);
        }
        return new OperationalDataResetResult("DEPARTMENT", mode, departmentId, deletedCounts);
    }

    private void populateGlobalResourceDeletionCounts(Map<String, Integer> deletedCounts) {
        deletedCounts.put("maintenanceItems", deleteAll("maintenance_items"));
        deletedCounts.put("facilityBookings", deleteAll("app_facility_bookings"));
        deletedCounts.put("resourceRequests", deleteAll("app_resource_requests"));
        deletedCounts.put("bookingApprovalHistory", deleteAll("booking_approval_history"));
        deletedCounts.put("bookings", deleteAll("bookings"));
        deletedCounts.put("resources", deleteAll("resources"));
    }

    private void populateDepartmentResourceDeletionCounts(Map<String, Integer> deletedCounts, Long departmentId) {
        deletedCounts.put("maintenanceItems", deleteByDepartmentResources(
                "DELETE FROM maintenance_items WHERE resource_id IN (SELECT id FROM resources WHERE department_id = ?) OR equipment_id IN (SELECT id FROM resources WHERE department_id = ?)",
                departmentId,
                departmentId));
        deletedCounts.put("facilityBookings", deleteByDepartmentResources(
                "DELETE FROM app_facility_bookings WHERE resource_id IN (SELECT id FROM resources WHERE department_id = ?)",
                departmentId));
        deletedCounts.put("resourceRequests", deleteByDepartmentResources(
                "DELETE FROM app_resource_requests WHERE resource_id IN (SELECT id FROM resources WHERE department_id = ?)",
                departmentId));
        deletedCounts.put("bookingApprovalHistory", deleteByDepartmentResources(
                "DELETE FROM booking_approval_history WHERE booking_id IN (SELECT id FROM bookings WHERE resource_id IN (SELECT id FROM resources WHERE department_id = ?))",
                departmentId));
        deletedCounts.put("bookings", deleteByDepartmentResources(
                "DELETE FROM bookings WHERE resource_id IN (SELECT id FROM resources WHERE department_id = ?)",
                departmentId));
        deletedCounts.put("resources", deleteByDepartmentResources(
                "DELETE FROM resources WHERE department_id = ?",
                departmentId));
    }

    private String normalizeMode(String requestedMode) {
        if (requestedMode == null || requestedMode.isBlank()) {
            return "ALL";
        }
        return requestedMode.trim().toUpperCase(Locale.ROOT);
    }

    private int deleteAll(String tableName) {
        return jdbcTemplate.update("DELETE FROM " + tableName);
    }

    private int deleteByDepartmentResources(String sql, Object... args) {
        return jdbcTemplate.update(sql, args);
    }
}
