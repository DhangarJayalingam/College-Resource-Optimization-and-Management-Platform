package com.collegeopt.platform.timetable;

import com.collegeopt.platform.resource.ResourceDto;
import com.collegeopt.platform.resource.ResourceService;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Service;

import java.sql.PreparedStatement;
import java.sql.Statement;
import java.time.Duration;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.Set;

@Service
public class TimetableService {

    private static final List<String> ACADEMIC_LEVELS = List.of("FE", "SE", "TE", "BE");
    private static final List<String> DEFAULT_DAYS = List.of("MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY");
    private static final List<LocalTime> DEFAULT_START_TIMES = List.of(
            LocalTime.of(9, 0), LocalTime.of(10, 0), LocalTime.of(11, 0),
            LocalTime.of(13, 0), LocalTime.of(14, 0), LocalTime.of(15, 0)
    );
    private static final Map<String, String> FACULTY_SHORT_CODES = buildFacultyShortCodes();

    private final JdbcTemplate jdbcTemplate;
    private final ResourceService resourceService;

    public TimetableService(JdbcTemplate jdbcTemplate, ResourceService resourceService) {
        this.jdbcTemplate = jdbcTemplate;
        this.resourceService = resourceService;
        ensureTable();
    }

    public List<TimetableEntryDto> listEntries() {
        return jdbcTemplate.query(
                """
                        SELECT id, course_code, academic_level, section_code, faculty_user_id, faculty_name,
                               department_id, resource_id, resource_name, day_of_week, start_time, end_time,
                               duration, type, classroom_id, laboratory_id, generated_by_ai
                        FROM app_timetable_entries
                        ORDER BY day_of_week, start_time, id
                        """,
                (rs, rowNum) -> mapEntry(rs)
        );
    }

    public List<TimetableEntryDto> listEntriesByDepartment(Long departmentId) {
        return jdbcTemplate.query(
                """
                        SELECT id, course_code, academic_level, section_code, faculty_user_id, faculty_name,
                               department_id, resource_id, resource_name, day_of_week, start_time, end_time,
                               duration, type, classroom_id, laboratory_id, generated_by_ai
                        FROM app_timetable_entries
                        WHERE department_id = ?
                        ORDER BY day_of_week, start_time, id
                        """,
                (rs, rowNum) -> mapEntry(rs),
                departmentId
        );
    }

    public TimetableEntryDto createEntry(CreateTimetableEntryRequest request) {
        Long selectedResourceId = request.classroomId() != null ? request.classroomId() : request.laboratoryId();
        ResourceDto resource = selectedResourceId != null ? resourceService.getResource(selectedResourceId) : null;
        TimetableEntryType entryType = normalizeEntryType(request.type());
        int duration = normalizeDuration(request.duration(), entryType);
        validateDurationAgainstTimes(request.startTime(), request.endTime(), duration, entryType);
        validateConflict(
                null,
                request.facultyUserId(),
                request.dayOfWeek().toUpperCase(),
                request.startTime(),
                request.endTime(),
                duration,
                request.classroomId(),
                request.laboratoryId()
        );

        return insertEntry(new TimetableEntryDto(
                null,
                request.courseCode(),
                inferAcademicLevel(request.sectionCode()),
                request.sectionCode(),
                request.facultyUserId(),
                request.facultyName(),
                resource != null ? resource.departmentId() : 1L,
                selectedResourceId,
                resource != null ? resource.name() : "Pending assignment",
                request.dayOfWeek().toUpperCase(),
                request.startTime(),
                request.endTime(),
                duration,
                entryType,
                request.classroomId(),
                request.laboratoryId(),
                false
        ));
    }

    public TimetableEntryDto createEntry(UpsertTimetableEntryRequest request) {
        TimetableEntryDto entry = buildManagedEntry(null, request);
        validateConflict(entry.id(), entry.facultyUserId(), entry.dayOfWeek(), entry.startTime(), entry.endTime(), entry.duration(), entry.classroomId(), entry.laboratoryId());
        return insertEntry(entry);
    }

    public TimetableEntryDto updateEntry(Long id, UpsertTimetableEntryRequest request) {
        getEntry(id);
        TimetableEntryDto updated = buildManagedEntry(id, request);
        validateConflict(updated.id(), updated.facultyUserId(), updated.dayOfWeek(), updated.startTime(), updated.endTime(), updated.duration(), updated.classroomId(), updated.laboratoryId());

        int count = jdbcTemplate.update(
                """
                        UPDATE app_timetable_entries
                        SET course_code = ?, academic_level = ?, section_code = ?, faculty_user_id = ?, faculty_name = ?,
                            department_id = ?, resource_id = ?, resource_name = ?, day_of_week = ?, start_time = ?, end_time = ?,
                            duration = ?, type = ?, classroom_id = ?, laboratory_id = ?, generated_by_ai = ?
                        WHERE id = ?
                        """,
                updated.courseCode(),
                updated.academicLevel(),
                updated.sectionCode(),
                updated.facultyUserId(),
                updated.facultyName(),
                updated.departmentId(),
                updated.resourceId(),
                updated.resourceName(),
                updated.dayOfWeek(),
                updated.startTime(),
                updated.endTime(),
                updated.duration(),
                updated.type().name(),
                updated.classroomId(),
                updated.laboratoryId(),
                updated.generatedByAi(),
                id
        );
        if (count == 0) {
            throw new NoSuchElementException("Timetable entry not found");
        }
        return getEntry(id);
    }

    public void deleteEntry(Long id) {
        int removed = jdbcTemplate.update("DELETE FROM app_timetable_entries WHERE id = ?", id);
        if (removed == 0) {
            throw new NoSuchElementException("Timetable entry not found");
        }
    }

    public TimetableEntryDto getEntry(Long id) {
        List<TimetableEntryDto> results = jdbcTemplate.query(
                """
                        SELECT id, course_code, academic_level, section_code, faculty_user_id, faculty_name,
                               department_id, resource_id, resource_name, day_of_week, start_time, end_time,
                               duration, type, classroom_id, laboratory_id, generated_by_ai
                        FROM app_timetable_entries
                        WHERE id = ?
                        """,
                (rs, rowNum) -> mapEntry(rs),
                id
        );
        if (results.isEmpty()) {
            throw new NoSuchElementException("Timetable entry not found");
        }
        return results.get(0);
    }

    public List<TimetableConflictDto> detectConflicts() {
        return detectConflicts(listEntries());
    }

    public List<TimetableConflictDto> detectConflicts(Long departmentId) {
        return detectConflicts(listEntriesByDepartment(departmentId));
    }

    private List<TimetableConflictDto> detectConflicts(List<TimetableEntryDto> entries) {
        List<TimetableConflictDto> conflicts = new ArrayList<>();
        for (int i = 0; i < entries.size(); i++) {
            for (int j = i + 1; j < entries.size(); j++) {
                TimetableEntryDto a = entries.get(i);
                TimetableEntryDto b = entries.get(j);
                if (!a.dayOfWeek().equalsIgnoreCase(b.dayOfWeek()) || !isOverlap(a, b)) {
                    continue;
                }

                if (a.facultyUserId().equals(b.facultyUserId())) {
                    conflicts.add(new TimetableConflictDto("FACULTY_CLASH", a.id(), b.id(),
                            "Faculty assigned to two sections at the same time"));
                }

                if (a.classroomId() != null && a.classroomId().equals(b.classroomId())) {
                    conflicts.add(new TimetableConflictDto("ROOM_DOUBLE_BOOKING", a.id(), b.id(),
                            "Classroom double booking detected"));
                }

                if (a.laboratoryId() != null && a.laboratoryId().equals(b.laboratoryId())) {
                    conflicts.add(new TimetableConflictDto("LAB_DOUBLE_BOOKING", a.id(), b.id(),
                            "Laboratory double booking detected"));
                }
            }
        }
        return conflicts;
    }

    public List<TimetableEntryDto> generateAiTimetable(TimetableGenerateRequest request) {
        List<TimetableEntryDto> generated = new ArrayList<>();
        int dayCursor = 0;
        int slotCursor = 0;

        for (TimetableGenerateRequest.SectionRequirement requirement : request.sections()) {
            String day = DEFAULT_DAYS.get(dayCursor % DEFAULT_DAYS.size());
            LocalTime startTime = DEFAULT_START_TIMES.get(slotCursor % DEFAULT_START_TIMES.size());
            TimetableEntryType entryType = requirement.type() == null ? TimetableEntryType.LECTURE : normalizeEntryType(requirement.type());
            int duration = normalizeDuration(requirement.duration() == null ? 1 : requirement.duration(), entryType);
            LocalTime endTime = startTime.plusHours(duration);

            Long classroomId = null;
            Long laboratoryId = null;
            Long resourceId = null;
            ResourceDto resource = null;

            if (entryType == TimetableEntryType.LAB) {
                laboratoryId = resourceService.recommendLaboratory(requirement.expectedStudents(), requirement.requiredTags())
                        .map(lab -> lab.id())
                        .orElse(null);
                resourceId = laboratoryId;
            } else {
                classroomId = resourceService.recommendClassroom(requirement.expectedStudents(), requirement.requiredTags())
                        .map(classroom -> classroom.id())
                        .orElse(null);
                resourceId = classroomId;
            }

            resource = resourceId != null ? resourceService.getResource(resourceId) : null;

            TimetableEntryDto entry = insertEntry(new TimetableEntryDto(
                    null,
                    requirement.courseCode(),
                    inferAcademicLevel(requirement.sectionCode()),
                    requirement.sectionCode(),
                    3L,
                    "AI Assigned Faculty",
                    resource != null ? resource.departmentId() : 1L,
                    resourceId,
                    resource != null ? resource.name() : "Pending assignment",
                    day,
                    startTime,
                    endTime,
                    duration,
                    entryType,
                    classroomId,
                    laboratoryId,
                    true
            ));
            generated.add(entry);

            slotCursor += duration;
            if (slotCursor >= DEFAULT_START_TIMES.size()) {
                slotCursor = slotCursor % DEFAULT_START_TIMES.size();
                dayCursor++;
            }
        }
        return generated;
    }

    public Map<String, Long> facultyWorkloadDistribution() {
        return listEntries().stream().collect(
                LinkedHashMap::new,
                (map, entry) -> incrementCount(map, entry.facultyName()),
                Map::putAll
        );
    }

    public Map<String, Long> facultyWorkloadDistribution(Long departmentId) {
        return listEntriesByDepartment(departmentId).stream().collect(
                LinkedHashMap::new,
                (map, entry) -> incrementCount(map, entry.facultyName()),
                Map::putAll
        );
    }

    public Map<String, Long> weeklyHeatmap() {
        Map<String, Long> heatmap = new LinkedHashMap<>();
        List<TimetableEntryDto> entries = listEntries();
        for (String day : Set.of("MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY")) {
            heatmap.put(day, entries.stream().filter(entry -> day.equalsIgnoreCase(entry.dayOfWeek())).count());
        }
        return heatmap;
    }

    public Map<String, Long> weeklyHeatmap(Long departmentId) {
        Map<String, Long> heatmap = new LinkedHashMap<>();
        List<TimetableEntryDto> departmentEntries = listEntriesByDepartment(departmentId);
        for (String day : Set.of("MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY")) {
            heatmap.put(day, departmentEntries.stream().filter(entry -> day.equalsIgnoreCase(entry.dayOfWeek())).count());
        }
        return heatmap;
    }

    private TimetableEntryDto insertEntry(TimetableEntryDto entry) {
        KeyHolder keyHolder = new GeneratedKeyHolder();
        jdbcTemplate.update(connection -> {
            PreparedStatement statement = connection.prepareStatement(
                    """
                            INSERT INTO app_timetable_entries (
                                course_code, academic_level, section_code, faculty_user_id, faculty_name, department_id,
                                resource_id, resource_name, day_of_week, start_time, end_time, duration, type, classroom_id, laboratory_id, generated_by_ai
                            )
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                            """,
                    Statement.RETURN_GENERATED_KEYS
            );
            bindEntry(statement, entry);
            return statement;
        }, keyHolder);

        Number id = keyHolder.getKey();
        if (id == null) {
            throw new IllegalStateException("Could not create timetable entry");
        }
        return getEntry(id.longValue());
    }

    private boolean isOverlap(TimetableEntryDto first, TimetableEntryDto second) {
        return first.startTime().isBefore(second.endTime()) && second.startTime().isBefore(first.endTime());
    }

    private void incrementCount(Map<String, Long> map, String key) {
        map.put(key, map.getOrDefault(key, 0L) + 1L);
    }

    private TimetableEntryDto buildManagedEntry(Long id, UpsertTimetableEntryRequest request) {
        String normalizedType = request.resourceType().trim().toUpperCase();
        Long classroomId = null;
        Long laboratoryId = null;
        TimetableEntryType entryType = normalizeEntryType(request.type());
        int duration = normalizeDuration(request.duration(), entryType);

        if ("CLASSROOM".equals(normalizedType)) {
            if (!resourceService.hasClassroom(request.resourceId())) {
                throw new IllegalArgumentException("Selected classroom does not exist");
            }
            classroomId = request.resourceId();
        } else if ("LAB".equals(normalizedType)) {
            if (!resourceService.hasLaboratory(request.resourceId())) {
                throw new IllegalArgumentException("Selected laboratory does not exist");
            }
            laboratoryId = request.resourceId();
        } else {
            throw new IllegalArgumentException("Resource type must be CLASSROOM or LAB");
        }

        if (entryType == TimetableEntryType.LAB && laboratoryId == null) {
            throw new IllegalArgumentException("LAB entries must be assigned to a laboratory resource");
        }
        if (entryType == TimetableEntryType.LECTURE && classroomId == null) {
            throw new IllegalArgumentException("LECTURE entries must be assigned to a classroom resource");
        }

        ResourceDto resource = resourceService.getResource(request.resourceId());
        FacultyMatch faculty = resolveFaculty(resource.departmentId(), request.faculty());
        validateDurationAgainstTimes(request.startTime(), request.endTime(), duration, entryType);

        return new TimetableEntryDto(
                id,
                request.course().trim(),
                normalizeAcademicLevel(request.academicLevel()),
                normalizeSectionCode(request.sectionCode()),
                faculty.id(),
                faculty.fullName(),
                resource.departmentId(),
                resource.id(),
                resource.name(),
                request.dayOfWeek().trim().toUpperCase(),
                request.startTime(),
                request.endTime(),
                duration,
                entryType,
                classroomId,
                laboratoryId,
                false
        );
    }

    private void validateConflict(Long currentId,
                                  Long facultyUserId,
                                  String dayOfWeek,
                                  LocalTime startTime,
                                  LocalTime endTime,
                                  int duration,
                                  Long classroomId,
                                  Long laboratoryId) {
        if (!startTime.isBefore(endTime)) {
            throw new IllegalArgumentException("Start time must be before end time");
        }

        for (TimetableEntryDto existing : listEntries()) {
            if (currentId != null && existing.id().equals(currentId)) {
                continue;
            }
            if (!existing.dayOfWeek().equalsIgnoreCase(dayOfWeek)) {
                continue;
            }

            TimetableEntryDto candidate = new TimetableEntryDto(
                    -1L,
                    "TEMP",
                    "TEMP",
                    "TEMP",
                    facultyUserId,
                    "TEMP",
                    1L,
                    classroomId != null ? classroomId : laboratoryId,
                    "TEMP",
                    dayOfWeek,
                    startTime,
                    endTime,
                    duration,
                    laboratoryId != null ? TimetableEntryType.LAB : TimetableEntryType.LECTURE,
                    classroomId,
                    laboratoryId,
                    false
            );

            if (!isOverlap(existing, candidate)) {
                continue;
            }

            if (facultyUserId != null && facultyUserId.equals(existing.facultyUserId())) {
                throw new IllegalArgumentException("Faculty conflict detected for the selected time slot");
            }
            if (classroomId != null && classroomId.equals(existing.classroomId())) {
                throw new IllegalArgumentException("Classroom conflict detected for the selected time slot");
            }
            if (laboratoryId != null && laboratoryId.equals(existing.laboratoryId())) {
                throw new IllegalArgumentException("Laboratory conflict detected for the selected time slot");
            }
        }
    }

    private FacultyMatch resolveFaculty(Long departmentId, String facultyName) {
        String normalizedFacultyName = facultyName == null ? "" : facultyName.trim();
        if (normalizedFacultyName.isBlank()) {
            throw new IllegalArgumentException("Faculty is required");
        }

        String canonicalFacultyName = FACULTY_SHORT_CODES.getOrDefault(
                normalizedFacultyName.toUpperCase(),
                normalizedFacultyName
        );

        List<FacultyMatch> matches = jdbcTemplate.query(
                """
                        SELECT DISTINCT u.id, u.full_name
                        FROM users u
                        JOIN user_roles ur ON ur.user_id = u.id
                        JOIN roles r ON r.id = ur.role_id
                        WHERE r.role_name IN ('FACULTY', 'COLLEGE_ADMIN')
                          AND u.department_id = ?
                          AND UPPER(TRIM(u.full_name)) = UPPER(TRIM(?))
                        ORDER BY u.id
                        """,
                (rs, rowNum) -> new FacultyMatch(rs.getLong("id"), rs.getString("full_name")),
                departmentId,
                canonicalFacultyName
        );

        if (matches.isEmpty()) {
            throw new IllegalArgumentException("Selected faculty was not found in the chosen department");
        }

        return matches.get(0);
    }

    private static Map<String, String> buildFacultyShortCodes() {
        Map<String, String> codes = new HashMap<>();
        codes.put("WDP", "PATIL WALMIK DHARMARAJ");
        codes.put("RPP", "PACHGHARE RADHIKA PANKAJ");
        codes.put("SAK", "KHOT SUREKHA ANNAPPA");
        codes.put("SPP", "DEORE SAHILA KASHINATH");
        codes.put("PPP", "POTRAJE POONAM PRAKASH");
        codes.put("MND", "DEORE MANASI NANDKISHOR");
        codes.put("SSD", "DEORE SAREEN SHANKAR");
        codes.put("VYB", "BHOLE VARSHA YOGESH");
        codes.put("SSL", "SAMPADA LOKHANDE");
        return codes;
    }

    private record FacultyMatch(Long id, String fullName) {
    }

    private TimetableEntryDto mapEntry(java.sql.ResultSet rs) throws java.sql.SQLException {
        return new TimetableEntryDto(
                rs.getLong("id"),
                rs.getString("course_code"),
                rs.getString("academic_level"),
                rs.getString("section_code"),
                rs.getLong("faculty_user_id"),
                rs.getString("faculty_name"),
                rs.getLong("department_id"),
                rs.getObject("resource_id", Long.class),
                rs.getString("resource_name"),
                rs.getString("day_of_week"),
                rs.getTime("start_time").toLocalTime(),
                rs.getTime("end_time").toLocalTime(),
                rs.getInt("duration"),
                TimetableEntryType.valueOf(rs.getString("type")),
                rs.getObject("classroom_id", Long.class),
                rs.getObject("laboratory_id", Long.class),
                rs.getBoolean("generated_by_ai")
        );
    }

    private void bindEntry(PreparedStatement statement, TimetableEntryDto entry) throws java.sql.SQLException {
        statement.setString(1, entry.courseCode());
        statement.setString(2, entry.academicLevel());
        statement.setString(3, entry.sectionCode());
        statement.setLong(4, entry.facultyUserId());
        statement.setString(5, entry.facultyName());
        statement.setLong(6, entry.departmentId());
        if (entry.resourceId() == null) {
            statement.setNull(7, java.sql.Types.BIGINT);
        } else {
            statement.setLong(7, entry.resourceId());
        }
        statement.setString(8, entry.resourceName());
        statement.setString(9, entry.dayOfWeek());
        statement.setTime(10, java.sql.Time.valueOf(entry.startTime()));
        statement.setTime(11, java.sql.Time.valueOf(entry.endTime()));
        statement.setInt(12, entry.duration());
        statement.setString(13, entry.type().name());
        if (entry.classroomId() == null) {
            statement.setNull(14, java.sql.Types.BIGINT);
        } else {
            statement.setLong(14, entry.classroomId());
        }
        if (entry.laboratoryId() == null) {
            statement.setNull(15, java.sql.Types.BIGINT);
        } else {
            statement.setLong(15, entry.laboratoryId());
        }
        statement.setBoolean(16, entry.generatedByAi());
    }

    private void ensureTable() {
        jdbcTemplate.execute(
                """
                        CREATE TABLE IF NOT EXISTS app_timetable_entries (
                            id BIGINT PRIMARY KEY AUTO_INCREMENT,
                            course_code VARCHAR(120) NOT NULL,
                            academic_level VARCHAR(20) NOT NULL,
                            section_code VARCHAR(30) NOT NULL,
                            faculty_user_id BIGINT NOT NULL,
                            faculty_name VARCHAR(255) NOT NULL,
                            department_id BIGINT NOT NULL,
                            resource_id BIGINT NULL,
                            resource_name VARCHAR(255) NOT NULL,
                            day_of_week VARCHAR(20) NOT NULL,
                            start_time TIME NOT NULL,
                            end_time TIME NOT NULL,
                            duration INT NOT NULL DEFAULT 1,
                            type VARCHAR(20) NOT NULL DEFAULT 'LECTURE',
                            classroom_id BIGINT NULL,
                            laboratory_id BIGINT NULL,
                            generated_by_ai BOOLEAN NOT NULL DEFAULT FALSE
                        )
                        """
        );
        if (!hasColumn("app_timetable_entries", "duration")) {
            jdbcTemplate.execute("ALTER TABLE app_timetable_entries ADD COLUMN duration INT NOT NULL DEFAULT 1 AFTER end_time");
        }
        if (!hasColumn("app_timetable_entries", "type")) {
            jdbcTemplate.execute("ALTER TABLE app_timetable_entries ADD COLUMN type VARCHAR(20) NOT NULL DEFAULT 'LECTURE' AFTER duration");
        }
        jdbcTemplate.execute(
                """
                        UPDATE app_timetable_entries
                        SET duration = GREATEST(
                                1,
                                TIMESTAMPDIFF(MINUTE,
                                    TIMESTAMP(CURRENT_DATE(), start_time),
                                    TIMESTAMP(CURRENT_DATE(), end_time)
                                ) / 60
                            )
                        WHERE duration IS NULL OR duration < 1
                        """
        );
        jdbcTemplate.execute(
                """
                        UPDATE app_timetable_entries
                        SET type = CASE
                            WHEN laboratory_id IS NOT NULL THEN 'LAB'
                            ELSE 'LECTURE'
                        END
                        WHERE type IS NULL OR type = ''
                        """
        );
    }

    private String inferAcademicLevel(String sectionCode) {
        String normalizedSection = normalizeSectionCode(sectionCode);
        if (normalizedSection.startsWith("F")) return "FE";
        if (normalizedSection.startsWith("S")) return "SE";
        if (normalizedSection.startsWith("T")) return "TE";
        if (normalizedSection.startsWith("B")) return "BE";
        throw new IllegalArgumentException("Section code must start with F, S, T, or B");
    }

    private String normalizeAcademicLevel(String academicLevel) {
        String normalized = academicLevel == null ? "" : academicLevel.trim().toUpperCase();
        if (!ACADEMIC_LEVELS.contains(normalized)) {
            throw new IllegalArgumentException("Academic level must be FE, SE, TE, or BE");
        }
        return normalized;
    }

    private String normalizeSectionCode(String sectionCode) {
        String normalized = sectionCode == null ? "" : sectionCode.trim().toUpperCase();
        if (normalized.isBlank()) {
            throw new IllegalArgumentException("Section code is required");
        }
        if (!normalized.matches("[FSTB](ALL|[0-9]+)")) {
            throw new IllegalArgumentException("Section code must look like F1, S1, T1, B1, or SALL");
        }
        return normalized;
    }

    private TimetableEntryType normalizeEntryType(TimetableEntryType type) {
        if (type == null) {
            throw new IllegalArgumentException("Entry type is required");
        }
        return type;
    }

    private int normalizeDuration(Integer duration, TimetableEntryType type) {
        if (duration == null || duration < 1) {
            throw new IllegalArgumentException("Duration must be at least 1 slot");
        }
        if (type == TimetableEntryType.LECTURE && duration != 1) {
            throw new IllegalArgumentException("LECTURE entries must use exactly 1 slot");
        }
        return duration;
    }

    private void validateDurationAgainstTimes(LocalTime startTime, LocalTime endTime, int duration, TimetableEntryType type) {
        if (startTime == null || endTime == null || !startTime.isBefore(endTime)) {
            throw new IllegalArgumentException("Start time must be before end time");
        }

        long totalMinutes = Duration.between(startTime, endTime).toMinutes();
        if (totalMinutes <= 0) {
            throw new IllegalArgumentException("Start time must be before end time");
        }
        if (totalMinutes % duration != 0) {
            throw new IllegalArgumentException("Slots must be continuous across the selected duration");
        }
        long slotMinutes = totalMinutes / duration;
        if (slotMinutes <= 0) {
            throw new IllegalArgumentException("Invalid timetable duration");
        }
        if (type == TimetableEntryType.LAB && slotMinutes < 30) {
            throw new IllegalArgumentException("LAB duration must cover continuous timetable slots");
        }
    }

    private boolean hasColumn(String tableName, String columnName) {
        Integer count = jdbcTemplate.queryForObject(
                """
                        SELECT COUNT(*)
                        FROM information_schema.columns
                        WHERE table_schema = DATABASE()
                          AND table_name = ?
                          AND column_name = ?
                        """,
                Integer.class,
                tableName,
                columnName
        );
        return count != null && count > 0;
    }
}
