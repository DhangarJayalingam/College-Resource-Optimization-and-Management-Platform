package com.collegeopt.platform.analytics;

import com.collegeopt.platform.campus.DepartmentDto;
import com.collegeopt.platform.campus.DepartmentService;
import com.collegeopt.platform.booking.BookingService;
import com.collegeopt.platform.resource.ClassroomDto;
import com.collegeopt.platform.resource.ResourceDto;
import com.collegeopt.platform.resource.ResourceService;
import com.collegeopt.platform.resource.ResourceStatus;
import com.collegeopt.platform.timetable.TimetableService;
import com.collegeopt.platform.user.AppUser;
import com.collegeopt.platform.user.RoleType;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class AnalyticsService {

    private final ResourceService resourceService;
    private final TimetableService timetableService;
    private final BookingService bookingService;
    private final DepartmentService departmentService;

    public AnalyticsService(ResourceService resourceService,
                            TimetableService timetableService,
                            BookingService bookingService,
                            DepartmentService departmentService) {
        this.resourceService = resourceService;
        this.timetableService = timetableService;
        this.bookingService = bookingService;
        this.departmentService = departmentService;
    }

    public DashboardAnalyticsDto dashboard() {
        List<ClassroomDto> classrooms = resourceService.getClassrooms();
        long inUse = classrooms.stream().filter(classroom -> classroom.status() == ResourceStatus.IN_USE).count();
        double utilization = classrooms.isEmpty() ? 0 : (inUse * 100.0 / classrooms.size());

        List<Map<String, Object>> occupancy = classrooms.stream()
                .map(classroom -> {
                    Map<String, Object> row = new LinkedHashMap<>();
                    row.put("room", classroom.roomCode());
                    row.put("capacity", classroom.capacity());
                    row.put("status", classroom.status().name());
                    row.put("occupancyPercent", classroom.status() == ResourceStatus.IN_USE ? 100 : 35);
                    return row;
                })
                .toList();

        List<Map<String, Object>> idleResources = classrooms.stream()
                .filter(classroom -> classroom.status() == ResourceStatus.AVAILABLE)
                .map(classroom -> {
                    Map<String, Object> row = new LinkedHashMap<>();
                    row.put("resourceType", "CLASSROOM");
                    row.put("resourceId", classroom.id());
                    row.put("resourceName", classroom.roomCode());
                    row.put("idleHours", 5);
                    return row;
                })
                .toList();

        List<Map<String, Object>> departmentUsage = departmentService.listAll().stream()
                .map(department -> {
                    List<ResourceDto> departmentResources = resourceService.getResourcesByDepartment(department.id());
                    long totalResources = departmentResources.size();
                    long activeResources = departmentResources.stream()
                            .filter(resource -> resource.status() == ResourceStatus.IN_USE)
                            .count();
                    int departmentUtilization = totalResources == 0
                            ? 0
                            : (int) Math.round(activeResources * 100.0 / totalResources);
                    return usage(department.name(), departmentUtilization);
                })
                .toList();

        return new DashboardAnalyticsDto(
                utilization,
                occupancy,
                timetableService.facultyWorkloadDistribution(),
                timetableService.weeklyHeatmap(),
                idleResources,
                departmentUsage
        );
    }

    public DashboardAnalyticsDto dashboard(AppUser user) {
        if (user.roles().contains(RoleType.SUPER_ADMIN)) {
            return dashboard();
        }

        Long departmentId = user.departmentId();
        DepartmentDto department = departmentService.getById(departmentId);
        List<ResourceDto> departmentResources = resourceService.getResourcesByDepartment(departmentId);
        List<ClassroomDto> classrooms = resourceService.getClassroomsByDepartment(departmentId);
        long inUse = classrooms.stream().filter(classroom -> classroom.status() == ResourceStatus.IN_USE).count();
        double utilization = classrooms.isEmpty() ? 0 : (inUse * 100.0 / classrooms.size());

        List<Map<String, Object>> occupancy = classrooms.stream()
                .map(classroom -> {
                    Map<String, Object> row = new LinkedHashMap<>();
                    row.put("room", classroom.roomCode());
                    row.put("capacity", classroom.capacity());
                    row.put("status", classroom.status().name());
                    row.put("occupancyPercent", classroom.status() == ResourceStatus.IN_USE ? 100 : 35);
                    return row;
                })
                .toList();

        List<Map<String, Object>> idleResources = departmentResources.stream()
                .filter(resource -> resource.status() == ResourceStatus.AVAILABLE)
                .map(resource -> {
                    Map<String, Object> row = new LinkedHashMap<>();
                    row.put("resourceType", resource.type().name());
                    row.put("resourceId", resource.id());
                    row.put("resourceName", resource.name());
                    row.put("idleHours", 5);
                    return row;
                })
                .toList();

        return new DashboardAnalyticsDto(
                utilization,
                occupancy,
                timetableService.facultyWorkloadDistribution(departmentId),
                timetableService.weeklyHeatmap(departmentId),
                idleResources,
                List.of(usage(department.name(), (int) Math.round(utilization)))
        );
    }

    public Map<String, Object> systemOverview() {
        Map<String, Object> overview = new LinkedHashMap<>();
        overview.put("resources", resourceService.resourceUtilizationSummary());
        overview.put("timetableEntries", timetableService.listEntries().size());
        overview.put("bookingRequests", bookingService.getAllRequests().size());
        overview.put("facilityBookings", bookingService.getAllBookings().size());
        overview.put("conflicts", timetableService.detectConflicts().size());
        return overview;
    }

    private Map<String, Object> usage(String department, int utilizationPercent) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put("department", department);
        map.put("utilizationPercent", utilizationPercent);
        return map;
    }
}
