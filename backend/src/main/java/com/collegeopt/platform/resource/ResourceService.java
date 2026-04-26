package com.collegeopt.platform.resource;

import com.collegeopt.platform.activity.ActivityLogService;
import com.collegeopt.platform.activity.CreateActivityLogRequest;
import com.collegeopt.platform.booking.ResourceStatusPublisher;
import com.collegeopt.platform.campus.ResourceStatusEventDto;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Service;

import java.sql.PreparedStatement;
import java.sql.Statement;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.Arrays;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class ResourceService {

        private final JdbcTemplate jdbcTemplate;
        private final ActivityLogService activityLogService;
        private final ResourceStatusPublisher resourceStatusPublisher;

        public ResourceService(JdbcTemplate jdbcTemplate,
                        ActivityLogService activityLogService,
                        ResourceStatusPublisher resourceStatusPublisher) {
                this.jdbcTemplate = jdbcTemplate;
                this.activityLogService = activityLogService;
                this.resourceStatusPublisher = resourceStatusPublisher;
                ensureTable();
        }

        public List<ClassroomDto> getClassrooms() {
                return queryResourcesByType(ResourceType.CLASSROOM).stream()
                                .map(this::toClassroom)
                                .toList();
        }

        public List<ClassroomDto> getClassroomsByDepartment(Long departmentId) {
                return getResourcesByDepartment(departmentId).stream()
                                .filter(resource -> resource.type() == ResourceType.CLASSROOM)
                                .map(this::toClassroom)
                                .toList();
        }

        public List<LaboratoryDto> getLaboratories() {
                return queryResourcesByType(ResourceType.LAB).stream()
                                .map(this::toLaboratory)
                                .toList();
        }

        public List<EquipmentDto> getEquipmentAssets() {
                return queryResourcesByType(ResourceType.EQUIPMENT).stream()
                                .map(this::toEquipment)
                                .toList();
        }

        public List<ResourceDto> getAllResources() {
                return jdbcTemplate.query(
                                """
                                                SELECT id, name, type, capacity, building, department_id, tags_csv, status, assigned_lab_id, last_maintenance_date
                                                FROM resources
                                                ORDER BY type, name
                                                """,
                                (rs, rowNum) -> mapResource(rs));
        }

        public ResourceDto getResource(Long id) {
                List<ResourceDto> results = jdbcTemplate.query(
                                """
                                                SELECT id, name, type, capacity, building, department_id, tags_csv, status, assigned_lab_id, last_maintenance_date
                                                FROM resources
                                                WHERE id = ?
                                                """,
                                (rs, rowNum) -> mapResource(rs),
                                id);
                if (results.isEmpty()) {
                        throw new NoSuchElementException("Resource not found");
                }
                return results.get(0);
        }

        public ResourceDto createResource(UpsertResourceRequest request, Long actorUserId) {
                KeyHolder keyHolder = new GeneratedKeyHolder();
                jdbcTemplate.update(connection -> {
                        PreparedStatement statement = connection.prepareStatement(
                                        """
                                                        INSERT INTO resources (
                                                            name, type, capacity, building, department_id, tags_csv, status, assigned_lab_id, last_maintenance_date
                                                        )
                                                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                                                        """,
                                        Statement.RETURN_GENERATED_KEYS);
                        bindResource(statement, request);
                        return statement;
                }, keyHolder);

                Number id = keyHolder.getKey();
                if (id == null) {
                        throw new IllegalStateException("Could not create resource");
                }

                ResourceDto resource = getResource(id.longValue());
                activityLogService.log(new CreateActivityLogRequest(
                                actorUserId,
                                "Resource created",
                                "RESOURCE",
                                resource.id(),
                                Map.of("type", resource.type().name(), "departmentId", resource.departmentId())));
                publishResourceEvent(resource, null, resource.status().name(), "Resource created");
                return resource;
        }

        public ResourceDto updateResource(Long id, UpsertResourceRequest request, Long actorUserId) {
                ResourceDto existing = getResource(id);

                int updated = jdbcTemplate.update(
                                """
                                                UPDATE resources
                                                SET name = ?, type = ?, capacity = ?, building = ?, department_id = ?,
                                                    tags_csv = ?, status = ?, assigned_lab_id = ?, last_maintenance_date = ?
                                                WHERE id = ?
                                                """,
                                request.name().trim(),
                                request.type().name(),
                                request.capacity(),
                                request.building().trim(),
                                request.departmentId(),
                                writeTags(request.tags()),
                                normalizeStoredStatus(request.status()).name(),
                                request.assignedLabId(),
                                request.lastMaintenanceDate(),
                                id);

                if (updated == 0) {
                        throw new NoSuchElementException("Resource not found");
                }

                ResourceDto resource = getResource(id);
                activityLogService.log(new CreateActivityLogRequest(
                                actorUserId,
                                "Resource updated",
                                "RESOURCE",
                                resource.id(),
                                Map.of("type", resource.type().name(), "departmentId", resource.departmentId())));
                publishResourceEvent(resource, existing.status().name(), resource.status().name(), "Resource updated");
                return resource;
        }

        public void deleteResource(Long id, Long actorUserId) {
                ResourceDto existing = getResource(id);
                int deleted = jdbcTemplate.update("DELETE FROM resources WHERE id = ?", id);
                if (deleted == 0) {
                        throw new NoSuchElementException("Resource not found");
                }
                activityLogService.log(new CreateActivityLogRequest(
                                actorUserId,
                                "Resource deleted",
                                "RESOURCE",
                                id,
                                Map.of("type", existing.type().name())));
                publishResourceEvent(existing, existing.status().name(), null, "Resource deleted");
        }

        public Optional<ClassroomDto> recommendClassroom(int requiredCapacity, Set<String> requiredTags) {
                return getClassrooms().stream()
                                .filter(c -> c.status() == ResourceStatus.AVAILABLE)
                                .filter(c -> c.capacity() >= requiredCapacity)
                                .filter(c -> c.tags().containsAll(requiredTags))
                                .min(Comparator.comparingInt(c -> c.capacity() - requiredCapacity));
        }

        public Optional<LaboratoryDto> recommendLaboratory(int requiredCapacity, Set<String> requiredTags) {
                return getLaboratories().stream()
                                .filter(l -> l.status() == ResourceStatus.AVAILABLE)
                                .filter(l -> l.capacity() >= requiredCapacity)
                                .filter(l -> l.tags().containsAll(requiredTags))
                                .min(Comparator.comparingInt(l -> l.capacity() - requiredCapacity));
        }

        public Map<String, Object> resourceUtilizationSummary() {
                long availableClassrooms = getClassrooms().stream().filter(c -> c.status() == ResourceStatus.AVAILABLE)
                                .count();
                long availableLabs = getLaboratories().stream().filter(l -> l.status() == ResourceStatus.AVAILABLE)
                                .count();
                long availableEquipment = getEquipmentAssets().stream()
                                .filter(e -> e.status() == ResourceStatus.AVAILABLE).count();

                Map<String, Object> summary = new LinkedHashMap<>();
                summary.put("totalClassrooms", getClassrooms().size());
                summary.put("availableClassrooms", availableClassrooms);
                summary.put("totalLaboratories", getLaboratories().size());
                summary.put("availableLaboratories", availableLabs);
                summary.put("totalEquipmentAssets", getEquipmentAssets().size());
                summary.put("availableEquipmentAssets", availableEquipment);
                return summary;
        }

        public Map<String, Object> resourceUtilizationSummary(Long departmentId) {
                List<ResourceDto> departmentResources = getResourcesByDepartment(departmentId);
                long totalClassrooms = departmentResources.stream()
                                .filter(resource -> resource.type() == ResourceType.CLASSROOM).count();
                long availableClassrooms = departmentResources.stream()
                                .filter(resource -> resource.type() == ResourceType.CLASSROOM)
                                .filter(resource -> resource.status() == ResourceStatus.AVAILABLE)
                                .count();
                long totalLaboratories = departmentResources.stream()
                                .filter(resource -> resource.type() == ResourceType.LAB).count();
                long availableLaboratories = departmentResources.stream()
                                .filter(resource -> resource.type() == ResourceType.LAB)
                                .filter(resource -> resource.status() == ResourceStatus.AVAILABLE)
                                .count();
                long totalEquipmentAssets = departmentResources.stream()
                                .filter(resource -> resource.type() == ResourceType.EQUIPMENT).count();
                long availableEquipmentAssets = departmentResources.stream()
                                .filter(resource -> resource.type() == ResourceType.EQUIPMENT)
                                .filter(resource -> resource.status() == ResourceStatus.AVAILABLE)
                                .count();

                Map<String, Object> summary = new LinkedHashMap<>();
                summary.put("totalClassrooms", totalClassrooms);
                summary.put("availableClassrooms", availableClassrooms);
                summary.put("totalLaboratories", totalLaboratories);
                summary.put("availableLaboratories", availableLaboratories);
                summary.put("totalEquipmentAssets", totalEquipmentAssets);
                summary.put("availableEquipmentAssets", availableEquipmentAssets);
                return summary;
        }

        public ResourceDashboardDto dashboard(Long departmentId) {
                List<ResourceDto> scopedResources = departmentId == null ? getAllResources()
                                : getResourcesByDepartment(departmentId);
                List<ResourceScheduleItemDto> schedules = schedules(LocalDate.now(), departmentId);

                long activeBookings = schedules.stream()
                                .filter(item -> isActiveNow(item.bookingDate(), item.startTime(), item.endTime(),
                                                item.status()))
                                .count();

                int utilizationPercent = scopedResources.isEmpty()
                                ? 0
                                : (int) Math.round((activeBookings * 100.0) / scopedResources.size());

                Map<Long, Long> usageCounts = schedules.stream()
                                .collect(Collectors.groupingBy(ResourceScheduleItemDto::resourceId,
                                                Collectors.counting()));

                String mostUsedResource = usageCounts.entrySet().stream()
                                .max(Map.Entry.comparingByValue())
                                .flatMap(entry -> scopedResources.stream()
                                                .filter(resource -> resource.id().equals(entry.getKey()))
                                                .findFirst()
                                                .map(ResourceDto::name))
                                .orElse("No usage yet");

                List<String> underusedResources = scopedResources.stream()
                                .filter(resource -> usageCounts.getOrDefault(resource.id(), 0L) == 0)
                                .limit(5)
                                .map(ResourceDto::name)
                                .toList();

                return new ResourceDashboardDto(
                                utilizationPercent,
                                activeBookings,
                                mostUsedResource,
                                underusedResources);
        }

        public List<ResourceScheduleItemDto> schedules(LocalDate date, Long departmentId) {
                List<ResourceScheduleItemDto> advanced = jdbcTemplate.query(
                                """
                                                SELECT b.resource_id, COALESCE(r.name, 'Unknown') AS resource_name, b.resource_type,
                                                       COALESCE(r.department_id, 0) AS department_id, b.booking_date,
                                                       b.start_time, b.end_time, b.status
                                                FROM bookings b
                                                LEFT JOIN resources r ON r.id = b.resource_id
                                                WHERE b.booking_date = ?
                                                """
                                                + (departmentId == null ? ""
                                                                : " AND (r.department_id = ? OR r.id IS NULL)")
                                                + """
                                                                ORDER BY b.start_time, b.end_time
                                                                """,
                                (rs, rowNum) -> new ResourceScheduleItemDto(
                                                rs.getLong("resource_id"),
                                                rs.getString("resource_name"),
                                                ResourceType.valueOf(rs.getString("resource_type")),
                                                rs.getLong("department_id"),
                                                rs.getObject("booking_date", LocalDate.class),
                                                rs.getObject("start_time", LocalTime.class),
                                                rs.getObject("end_time", LocalTime.class),
                                                rs.getString("status"),
                                                "BOOKING"),
                                departmentId == null ? new Object[] { date } : new Object[] { date, departmentId });

                List<ResourceScheduleItemDto> legacy = jdbcTemplate.query(
                                """
                                                SELECT fb.resource_id, COALESCE(r.name, 'Unknown') AS resource_name, fb.resource_type,
                                                       COALESCE(r.department_id, 0) AS department_id, fb.booking_date,
                                                       fb.start_time, fb.end_time, fb.status
                                                FROM app_facility_bookings fb
                                                LEFT JOIN resources r ON r.id = fb.resource_id
                                                WHERE fb.booking_date = ?
                                                """
                                                + (departmentId == null ? ""
                                                                : " AND (r.department_id = ? OR r.id IS NULL)")
                                                + """
                                                                ORDER BY fb.start_time, fb.end_time
                                                                """,
                                (rs, rowNum) -> new ResourceScheduleItemDto(
                                                rs.getLong("resource_id"),
                                                rs.getString("resource_name"),
                                                ResourceType.valueOf(rs.getString("resource_type")),
                                                rs.getLong("department_id"),
                                                rs.getObject("booking_date", LocalDate.class),
                                                rs.getObject("start_time", LocalTime.class),
                                                rs.getObject("end_time", LocalTime.class),
                                                rs.getString("status"),
                                                "LEGACY_BOOKING"),
                                departmentId == null ? new Object[] { date } : new Object[] { date, departmentId });

                return java.util.stream.Stream.concat(advanced.stream(), legacy.stream())
                                .sorted(Comparator.comparing(ResourceScheduleItemDto::bookingDate)
                                                .thenComparing(ResourceScheduleItemDto::startTime)
                                                .thenComparing(ResourceScheduleItemDto::resourceName))
                                .toList();
        }

        public List<ResourceInsightDto> insights(LocalDate date, Long departmentId) {
                List<ResourceDto> scopedResources = departmentId == null ? getAllResources()
                                : getResourcesByDepartment(departmentId);
                List<ResourceScheduleItemDto> schedules = schedules(date, departmentId);
                Map<Long, List<ResourceScheduleItemDto>> schedulesByResourceId = schedules.stream()
                                .collect(Collectors.groupingBy(ResourceScheduleItemDto::resourceId));
                Map<Long, MaintenanceSnapshot> maintenanceByResourceId = loadMaintenanceSnapshots().stream()
                                .collect(Collectors.toMap(MaintenanceSnapshot::resourceId, snapshot -> snapshot,
                                                (first, second) -> first));

                return scopedResources.stream()
                                .map(resource -> {
                                        List<ResourceScheduleItemDto> resourceSchedules = schedulesByResourceId
                                                        .getOrDefault(resource.id(), List.of());
                                        long activeBookings = resourceSchedules.stream()
                                                        .filter(item -> isActiveNow(item.bookingDate(),
                                                                        item.startTime(), item.endTime(),
                                                                        item.status()))
                                                        .count();

                                        ResourceScheduleItemDto nextBooking = resourceSchedules.stream()
                                                        .filter(item -> item.bookingDate().isAfter(LocalDate.now())
                                                                        || (item.bookingDate().isEqual(LocalDate.now())
                                                                                        && item.startTime().isAfter(
                                                                                                        LocalTime.now())))
                                                        .min(Comparator.comparing(ResourceScheduleItemDto::bookingDate)
                                                                        .thenComparing(ResourceScheduleItemDto::startTime))
                                                        .orElse(null);

                                        boolean reservedSoon = resourceSchedules.stream()
                                                        .anyMatch(item -> isReservedSoon(item.bookingDate(),
                                                                        item.startTime(), item.endTime(),
                                                                        item.status()));

                                        MaintenanceSnapshot maintenance = maintenanceByResourceId.get(resource.id());
                                        int utilizationPercent = Math.min(100,
                                                        (int) Math.round(resourceSchedules.size() * 18.0));
                                        String usageLevel = utilizationPercent >= 70 ? "High"
                                                        : utilizationPercent >= 35 ? "Moderate" : "Low";

                                        return new ResourceInsightDto(
                                                        resource.id(),
                                                        resource.name(),
                                                        resource.type(),
                                                        resource.capacity(),
                                                        resource.building(),
                                                        resource.departmentId(),
                                                        resource.tags(),
                                                        deriveSmartStatus(resource, activeBookings > 0, reservedSoon),
                                                        utilizationPercent,
                                                        usageLevel,
                                                        maintenance != null && !"COMPLETED"
                                                                        .equalsIgnoreCase(maintenance.status()),
                                                        maintenance == null ? "NONE" : maintenance.status(),
                                                        resource.lastMaintenanceDate(),
                                                        nextBooking == null ? null : nextBooking.bookingDate(),
                                                        nextBooking == null ? null : nextBooking.startTime(),
                                                        nextBooking == null ? null : nextBooking.endTime(),
                                                        activeBookings);
                                })
                                .sorted(Comparator.comparing(ResourceInsightDto::name))
                                .toList();
        }

        public BestResourceSuggestionDto suggestBestResource(BestResourceSuggestionRequest request,
                        Long scopedDepartmentId) {
                Long effectiveDepartmentId = scopedDepartmentId != null ? scopedDepartmentId : request.departmentId();
                String requestedEquipment = request.equipment() == null ? "" : request.equipment().trim().toUpperCase();

                ResourceDto best = getAllResources().stream()
                                .filter(resource -> resource.type() == request.resourceType())
                                .filter(resource -> effectiveDepartmentId == null
                                                || resource.departmentId().equals(effectiveDepartmentId))
                                .filter(resource -> request.building() == null || request.building().isBlank()
                                                || resource.building().equalsIgnoreCase(request.building().trim()))
                                .filter(resource -> resource.capacity() >= request.capacity())
                                .filter(resource -> resource.status() != ResourceStatus.UNDER_MAINTENANCE)
                                .filter(resource -> requestedEquipment.isBlank() || resource.tags().stream()
                                                .anyMatch(tag -> tag.equalsIgnoreCase(requestedEquipment)))
                                .sorted(Comparator
                                                .comparing((ResourceDto resource) -> resource
                                                                .status() == ResourceStatus.AVAILABLE ? 0 : 1)
                                                .thenComparingInt(resource -> Math
                                                                .abs(resource.capacity() - request.capacity()))
                                                .thenComparing(ResourceDto::name))
                                .findFirst()
                                .orElseThrow(() -> new NoSuchElementException(
                                                "No suitable resource found for the selected criteria"));

                int score = 100;
                score -= Math.min(40, Math.abs(best.capacity() - request.capacity()));
                if (effectiveDepartmentId != null && !best.departmentId().equals(effectiveDepartmentId)) {
                        score -= 15;
                }
                if (!requestedEquipment.isBlank()
                                && best.tags().stream().noneMatch(tag -> tag.equalsIgnoreCase(requestedEquipment))) {
                        score -= 20;
                }

                String explanation = "Chosen for availability, department fit, and the closest capacity match."
                                + (request.building() != null && !request.building().isBlank()
                                                ? " Preferred building matched."
                                                : "")
                                + (!requestedEquipment.isBlank() ? " Equipment/tag preference checked." : "");

                return new BestResourceSuggestionDto(
                                "BEST_RESOURCE",
                                best.id(),
                                best.name(),
                                best.type(),
                                best.building(),
                                best.departmentId(),
                                Math.max(score, 1),
                                explanation);
        }

        public ClassroomDto updateClassroomStatus(Long id, ResourceStatus status) {
                ResourceDto resource = getResource(id);
                if (resource.type() != ResourceType.CLASSROOM) {
                        throw new NoSuchElementException("Classroom not found");
                }
                jdbcTemplate.update("UPDATE resources SET status = ? WHERE id = ?",
                                normalizeStoredStatus(status).name(), id);
                ResourceDto updated = getResource(id);
                publishResourceEvent(updated, resource.status().name(), status.name(), "Classroom status updated");
                return toClassroom(updated);
        }

        public LaboratoryDto updateLabStatus(Long id, ResourceStatus status) {
                ResourceDto resource = getResource(id);
                if (resource.type() != ResourceType.LAB) {
                        throw new NoSuchElementException("Laboratory not found");
                }
                jdbcTemplate.update("UPDATE resources SET status = ? WHERE id = ?",
                                normalizeStoredStatus(status).name(), id);
                ResourceDto updated = getResource(id);
                publishResourceEvent(updated, resource.status().name(), status.name(), "Laboratory status updated");
                return toLaboratory(updated);
        }

        public EquipmentDto updateEquipmentStatus(Long id, ResourceStatus status) {
                ResourceDto resource = getResource(id);
                if (resource.type() != ResourceType.EQUIPMENT) {
                        throw new NoSuchElementException("Equipment asset not found");
                }
                jdbcTemplate.update("UPDATE resources SET status = ? WHERE id = ?",
                                normalizeStoredStatus(status).name(), id);
                ResourceDto updated = getResource(id);
                publishResourceEvent(updated, resource.status().name(), status.name(), "Equipment status updated");
                return toEquipment(updated);
        }

        public List<ClassroomDto> searchClassrooms(ResourceSearchRequest request) {
                return getClassrooms().stream()
                                .filter(c -> c.status() == ResourceStatus.AVAILABLE)
                                .filter(c -> c.capacity() >= request.capacity())
                                .filter(c -> c.tags().containsAll(request.requiredTags()))
                                .sorted(Comparator.comparingInt(c -> c.capacity() - request.capacity()))
                                .collect(Collectors.toList());
        }

        public boolean hasClassroom(Long id) {
                return existsByIdAndType(id, ResourceType.CLASSROOM);
        }

        public boolean hasLaboratory(Long id) {
                return existsByIdAndType(id, ResourceType.LAB);
        }

        public List<EquipmentDto> getEquipmentForResource(Long resourceId) {
                return jdbcTemplate.query(
                                """
                                                SELECT id, name, type, capacity, building, department_id, tags_csv, status, assigned_lab_id, last_maintenance_date
                                                FROM resources
                                                WHERE type = 'EQUIPMENT' AND assigned_lab_id = ?
                                                ORDER BY name
                                                """,
                                (rs, rowNum) -> toEquipment(mapResource(rs)),
                                resourceId);
        }

        public List<ResourceDto> getResourcesByDepartment(Long departmentId) {
                return jdbcTemplate.query(
                                """
                                                SELECT id, name, type, capacity, building, department_id, tags_csv, status, assigned_lab_id, last_maintenance_date
                                                FROM resources
                                                WHERE department_id = ?
                                                ORDER BY type, name
                                                """,
                                (rs, rowNum) -> mapResource(rs),
                                departmentId);
        }

        private List<ResourceDto> queryResourcesByType(ResourceType type) {
                return jdbcTemplate.query(
                                """
                                                SELECT id, name, type, capacity, building, department_id, tags_csv, status, assigned_lab_id, last_maintenance_date
                                                FROM resources
                                                WHERE type = ?
                                                ORDER BY name
                                                """,
                                (rs, rowNum) -> mapResource(rs),
                                type.name());
        }

        private boolean existsByIdAndType(Long id, ResourceType type) {
                Integer count = jdbcTemplate.queryForObject(
                                "SELECT COUNT(*) FROM resources WHERE id = ? AND type = ?",
                                Integer.class,
                                id,
                                type.name());
                return count != null && count > 0;
        }

        private ResourceDto mapResource(java.sql.ResultSet rs) throws java.sql.SQLException {
                return withEffectiveStatus(new ResourceDto(
                                rs.getLong("id"),
                                rs.getString("name"),
                                ResourceType.valueOf(rs.getString("type")),
                                rs.getInt("capacity"),
                                rs.getString("building"),
                                rs.getLong("department_id"),
                                readTags(rs.getString("tags_csv")),
                                ResourceStatus.valueOf(rs.getString("status")),
                                rs.getObject("assigned_lab_id", Long.class),
                                rs.getObject("last_maintenance_date", LocalDate.class)));
        }

        private ClassroomDto toClassroom(ResourceDto resource) {
                return new ClassroomDto(resource.id(), resource.name(), resource.capacity(), resource.tags(),
                                resource.status());
        }

        private LaboratoryDto toLaboratory(ResourceDto resource) {
                return new LaboratoryDto(resource.id(), resource.name(), "GENERAL_LAB", resource.capacity(),
                                resource.tags(), resource.status());
        }

        private EquipmentDto toEquipment(ResourceDto resource) {
                String category = resource.tags().stream().findFirst().orElse("GENERAL");
                return new EquipmentDto(resource.id(), "EQ-" + resource.id(), resource.name(), category,
                                resource.status(), resource.assignedLabId());
        }

        private void bindResource(PreparedStatement statement, UpsertResourceRequest request)
                        throws java.sql.SQLException {
                statement.setString(1, request.name().trim());
                statement.setString(2, request.type().name());
                statement.setInt(3, request.capacity());
                statement.setString(4, request.building().trim());
                statement.setLong(5, request.departmentId());
                statement.setString(6, writeTags(request.tags()));
                statement.setString(7, normalizeStoredStatus(request.status()).name());
                if (request.assignedLabId() == null) {
                        statement.setNull(8, java.sql.Types.BIGINT);
                } else {
                        statement.setLong(8, request.assignedLabId());
                }
                if (request.lastMaintenanceDate() == null) {
                        statement.setNull(9, java.sql.Types.DATE);
                } else {
                        statement.setObject(9, request.lastMaintenanceDate());
                }
        }

        private String writeTags(Set<String> tags) {
                return tags == null ? ""
                                : tags.stream()
                                                .map(String::trim)
                                                .filter(tag -> !tag.isBlank())
                                                .sorted()
                                                .collect(Collectors.joining(","));
        }

        private Set<String> readTags(String raw) {
                if (raw == null || raw.isBlank()) {
                        return Set.of();
                }
                return Arrays.stream(raw.split(","))
                                .map(String::trim)
                                .filter(tag -> !tag.isBlank())
                                .collect(Collectors.toCollection(java.util.LinkedHashSet::new));
        }

        private void ensureTable() {
                jdbcTemplate.execute(
                                """
                                                CREATE TABLE IF NOT EXISTS resources (
                                                    id BIGINT PRIMARY KEY AUTO_INCREMENT,
                                                    name VARCHAR(255) NOT NULL,
                                                    type VARCHAR(40) NOT NULL,
                                                    capacity INT NOT NULL,
                                                    building VARCHAR(255) NOT NULL,
                                                    department_id BIGINT NOT NULL,
                                                    tags_csv TEXT NULL,
                                                    status VARCHAR(40) NOT NULL,
                                                    assigned_lab_id BIGINT NULL,
                                                    last_maintenance_date DATE NULL
                                                )
                                                """);
        }

        private ResourceDto withEffectiveStatus(ResourceDto resource) {
                if (resource.status() == ResourceStatus.UNDER_MAINTENANCE) {
                        return resource;
                }

                ResourceStatus effectiveStatus = hasActiveBookingNow(resource.id())
                                ? ResourceStatus.IN_USE
                                : ResourceStatus.AVAILABLE;

                return new ResourceDto(
                                resource.id(),
                                resource.name(),
                                resource.type(),
                                resource.capacity(),
                                resource.building(),
                                resource.departmentId(),
                                resource.tags(),
                                effectiveStatus,
                                resource.assignedLabId(),
                                resource.lastMaintenanceDate());
        }

        private String deriveSmartStatus(ResourceDto resource, boolean activeNow, boolean reservedSoon) {
                if (resource.status() == ResourceStatus.UNDER_MAINTENANCE) {
                        return "Maintenance";
                }
                if (activeNow) {
                        return "Occupied";
                }
                if (reservedSoon) {
                        return "Reserved soon";
                }
                return "Available";
        }

        private boolean isActiveNow(LocalDate bookingDate, LocalTime startTime, LocalTime endTime, String status) {
                return bookingDate != null
                                && bookingDate.isEqual(LocalDate.now())
                                && startTime != null
                                && endTime != null
                                && !isCancelledLike(status)
                                && !LocalTime.now().isBefore(startTime)
                                && LocalTime.now().isBefore(endTime);
        }

        private boolean isReservedSoon(LocalDate bookingDate, LocalTime startTime, LocalTime endTime, String status) {
                if (bookingDate == null || startTime == null || endTime == null || isCancelledLike(status)
                                || !bookingDate.isEqual(LocalDate.now())) {
                        return false;
                }
                LocalTime now = LocalTime.now();
                return startTime.isAfter(now) && !startTime.isAfter(now.plusMinutes(45));
        }

        private boolean isCancelledLike(String status) {
                return status != null && (status.equalsIgnoreCase("REJECTED") || status.equalsIgnoreCase("CANCELLED"));
        }

        private List<MaintenanceSnapshot> loadMaintenanceSnapshots() {
                return jdbcTemplate.query(
                                """
                                                SELECT resource_id, status
                                                FROM maintenance_items
                                                WHERE resource_id IS NOT NULL
                                                ORDER BY id DESC
                                                """,
                                (rs, rowNum) -> new MaintenanceSnapshot(
                                                rs.getLong("resource_id"),
                                                rs.getString("status")));
        }

        private record MaintenanceSnapshot(Long resourceId, String status) {
        }

        private boolean hasActiveBookingNow(Long resourceId) {
                Integer activeAdvancedBookings = jdbcTemplate.queryForObject(
                                """
                                                SELECT COUNT(*)
                                                FROM bookings
                                                WHERE resource_id = ?
                                                  AND booking_date = CURRENT_DATE()
                                                  AND start_time <= CURRENT_TIME()
                                                  AND end_time > CURRENT_TIME()
                                                  AND status IN ('APPROVED', 'IN_PROGRESS')
                                                """,
                                Integer.class,
                                resourceId);
                if (activeAdvancedBookings != null && activeAdvancedBookings > 0) {
                        return true;
                }

                Integer activeLegacyBookings = jdbcTemplate.queryForObject(
                                """
                                                SELECT COUNT(*)
                                                FROM app_facility_bookings
                                                WHERE resource_id = ?
                                                  AND booking_date = CURRENT_DATE()
                                                  AND start_time <= CURRENT_TIME()
                                                  AND end_time > CURRENT_TIME()
                                                  AND status <> 'REJECTED'
                                                """,
                                Integer.class,
                                resourceId);
                return activeLegacyBookings != null && activeLegacyBookings > 0;
        }

        private ResourceStatus normalizeStoredStatus(ResourceStatus status) {
                return status == ResourceStatus.IN_USE ? ResourceStatus.AVAILABLE : status;
        }

        private void publishResourceEvent(ResourceDto resource, String previousStatus, String currentStatus,
                        String context) {
                resourceStatusPublisher.publish(new ResourceStatusEventDto(
                                resource.id(),
                                resource.name(),
                                previousStatus,
                                currentStatus,
                                context,
                                LocalDateTime.now()));
        }
}
