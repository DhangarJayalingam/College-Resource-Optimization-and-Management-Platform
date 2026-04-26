package com.collegeopt.platform.campus;

import com.collegeopt.platform.resource.ResourceDto;
import com.collegeopt.platform.resource.ResourceService;
import com.collegeopt.platform.timetable.TimetableEntryDto;
import com.collegeopt.platform.timetable.TimetableService;
import com.collegeopt.platform.user.AppUser;
import com.collegeopt.platform.user.UserDirectoryService;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Service;

import java.sql.PreparedStatement;
import java.sql.Statement;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
public class DepartmentService {
    private final CampusService campusService;
    private final UserDirectoryService userDirectoryService;
    private final ResourceService resourceService;
    private final TimetableService timetableService;
    private final AnnouncementService announcementService;
    private final JdbcTemplate jdbcTemplate;
    private final boolean departmentDescriptionColumnPresent;

    private final RowMapper<DepartmentDto> departmentMapper = (rs, rowNum) -> new DepartmentDto(
            rs.getLong("id"),
            rs.getLong("campus_id"),
            rs.getString("dept_code"),
            rs.getString("name"),
            rs.getString("description")
    );

    public DepartmentService(CampusService campusService,
                             UserDirectoryService userDirectoryService,
                             ResourceService resourceService,
                             TimetableService timetableService,
                             AnnouncementService announcementService,
                             JdbcTemplate jdbcTemplate) {
        this.campusService = campusService;
        this.userDirectoryService = userDirectoryService;
        this.resourceService = resourceService;
        this.timetableService = timetableService;
        this.announcementService = announcementService;
        this.jdbcTemplate = jdbcTemplate;
        this.departmentDescriptionColumnPresent = hasDepartmentDescriptionColumn();
        seedDefaults();
    }

    public List<DepartmentDto> listAll() {
        return jdbcTemplate.query(listDepartmentsSql(), departmentMapper);
    }

    public DepartmentDto getById(Long id) {
        List<DepartmentDto> results = jdbcTemplate.query(getDepartmentByIdSql(), departmentMapper, id);

        if (results.isEmpty()) {
            throw new IllegalArgumentException("Department not found");
        }

        return results.get(0);
    }

    public DepartmentDetailDto getDetailById(Long id) {
        DepartmentDto department = getById(id);
        List<AppUser> faculty = userDirectoryService.listFacultyByDepartment(id);
        List<AppUser> students = userDirectoryService.listStudentsByDepartment(id);
        List<ResourceDto> resources = resourceService.getResourcesByDepartment(id);
        String campusName = campusService.getCampus(department.campusId()).name();

        return new DepartmentDetailDto(
                department.id(),
                department.name(),
                department.code(),
                department.description(),
                campusName,
                faculty.size(),
                students.size(),
                resources.size()
        );
    }

    public List<DepartmentFacultyDto> getFaculty(Long id) {
        DepartmentDto department = getById(id);
        List<String> subjectPool = subjectTemplatesForDepartment(department);

        return userDirectoryService.listTeachingStaffByDepartment(id).stream()
                .map(faculty -> new DepartmentFacultyDto(
                        faculty.id(),
                        faculty.fullName(),
                        faculty.email(),
                        subjectPool.isEmpty()
                                ? List.of("Department Subject")
                                : List.of(
                                subjectPool.get((int) (faculty.id() % subjectPool.size())),
                                subjectPool.get((int) ((faculty.id() + 1) % subjectPool.size()))
                        )))
                .toList();
    }

    public List<DepartmentStudentDto> getStudents(Long id) {
        DepartmentDto department = getById(id);
        List<String> coursePool = subjectTemplatesForDepartment(department);

        Map<Long, StudentProfileSnapshot> profilesByUserId = jdbcTemplate.query(
                """
                        SELECT user_id, pnr_no, roll_no, year_semester, semester
                        FROM student_profiles
                        WHERE user_id IN (
                            SELECT DISTINCT u.id
                            FROM users u
                            JOIN user_roles ur ON ur.user_id = u.id
                            JOIN roles r ON r.id = ur.role_id
                            WHERE r.role_name = 'STUDENT' AND u.department_id = ?
                        )
                        """,
                (rs, rowNum) -> new StudentProfileSnapshot(
                        rs.getLong("user_id"),
                        rs.getString("pnr_no"),
                        rs.getString("roll_no"),
                        rs.getString("year_semester"),
                        rs.getObject("semester", Integer.class)
                ),
                id
        ).stream().collect(java.util.stream.Collectors.toMap(StudentProfileSnapshot::userId, snapshot -> snapshot));

        return userDirectoryService.listStudentsByDepartment(id).stream()
                .map(student -> new DepartmentStudentDto(
                        student.id(),
                        student.fullName(),
                        student.email(),
                        profilesByUserId.get(student.id()) == null ? null : profilesByUserId.get(student.id()).pnrNo(),
                        profilesByUserId.get(student.id()) == null ? null : profilesByUserId.get(student.id()).rollNo(),
                        formatYearSemester(profilesByUserId.get(student.id())),
                        coursePool.stream().limit(3).toList()
                ))
                .toList();
    }

    public List<ResourceDto> getResources(Long id) {
        getById(id);
        return resourceService.getResourcesByDepartment(id);
    }

    public List<TimetableEntryDto> getTimetable(Long id) {
        getById(id);
        return timetableService.listEntries().stream()
                .filter(entry -> entry.departmentId().equals(id))
                .toList();
    }

    public List<AnnouncementDto> getAnnouncements(Long id, AppUser currentUser) {
        getById(id);
        return announcementService.listAnnouncementsForUser(currentUser).stream()
                .filter(announcement -> announcement.departmentId() == null || announcement.departmentId().equals(id))
                .toList();
    }

    public DepartmentDto create(DepartmentDto request) {
        campusService.getCampus(request.campusId());

        KeyHolder keyHolder = new GeneratedKeyHolder();
        jdbcTemplate.update(connection -> {
            PreparedStatement statement = connection.prepareStatement(createDepartmentSql(), Statement.RETURN_GENERATED_KEYS);
            statement.setLong(1, 1L);
            statement.setLong(2, request.campusId());
            statement.setString(3, request.code().trim().toUpperCase(Locale.ROOT));
            statement.setString(4, request.name().trim());
            if (departmentDescriptionColumnPresent) {
                statement.setString(5, normalizeDescription(request.description()));
            }
            return statement;
        }, keyHolder);

        Number id = keyHolder.getKey();
        if (id == null) {
            throw new IllegalStateException("Department creation failed");
        }

        return new DepartmentDto(id.longValue(), request.campusId(), request.code().trim().toUpperCase(Locale.ROOT), request.name().trim(), request.description());
    }

    public DepartmentDto update(Long id, DepartmentDto request) {
        getById(id);
        campusService.getCampus(request.campusId());

        int updated = updateDepartment(request, id);

        if (updated == 0) {
            throw new IllegalArgumentException("Department not found");
        }

        return new DepartmentDto(id, request.campusId(), request.code().trim().toUpperCase(Locale.ROOT), request.name().trim(), request.description());
    }

    public void delete(Long id) {
        int deleted = jdbcTemplate.update("DELETE FROM departments WHERE id = ?", id);
        if (deleted == 0) {
            throw new IllegalArgumentException("Department not found");
        }
    }

    private void seedDefaults() {
        seedDepartment(1L, "CSE", "Computer Science");
        seedDepartment(1L, "ECE", "Electronics and Communication");
        seedDepartment(2L, "MECH", "Mechanical Engineering");
    }

    private void seedDepartment(Long campusId, String code, String name) {
        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM departments WHERE campus_id = ? AND dept_code = ?",
                Integer.class,
                campusId,
                code
        );

        if (count != null && count > 0) {
            return;
        }

        jdbcTemplate.update(
                seedDepartmentSql(),
                departmentDescriptionColumnPresent
                        ? new Object[] { 1L, campusId, code, name, "" }
                        : new Object[] { 1L, campusId, code, name }
        );
    }

    private boolean hasDepartmentDescriptionColumn() {
        Integer count = jdbcTemplate.queryForObject(
                """
                        SELECT COUNT(*)
                        FROM INFORMATION_SCHEMA.COLUMNS
                        WHERE TABLE_SCHEMA = DATABASE()
                          AND TABLE_NAME = 'departments'
                          AND COLUMN_NAME = 'description'
                        """,
                Integer.class);
        return count != null && count > 0;
    }

    private String listDepartmentsSql() {
        return departmentDescriptionColumnPresent
                ? """
                        SELECT id, campus_id, dept_code, name, COALESCE(description, '') AS description
                        FROM departments
                        ORDER BY campus_id, dept_code
                        """
                : """
                        SELECT id, campus_id, dept_code, name, '' AS description
                        FROM departments
                        ORDER BY campus_id, dept_code
                        """;
    }

    private String getDepartmentByIdSql() {
        return departmentDescriptionColumnPresent
                ? """
                        SELECT id, campus_id, dept_code, name, COALESCE(description, '') AS description
                        FROM departments
                        WHERE id = ?
                        """
                : """
                        SELECT id, campus_id, dept_code, name, '' AS description
                        FROM departments
                        WHERE id = ?
                        """;
    }

    private String createDepartmentSql() {
        return departmentDescriptionColumnPresent
                ? """
                        INSERT INTO departments (tenant_id, campus_id, dept_code, name, description)
                        VALUES (?, ?, ?, ?, ?)
                        """
                : """
                        INSERT INTO departments (tenant_id, campus_id, dept_code, name)
                        VALUES (?, ?, ?, ?)
                        """;
    }

    private int updateDepartment(DepartmentDto request, Long id) {
        if (departmentDescriptionColumnPresent) {
            return jdbcTemplate.update(
                    """
                            UPDATE departments
                            SET campus_id = ?, dept_code = ?, name = ?, description = ?
                            WHERE id = ?
                            """,
                    request.campusId(),
                    request.code().trim().toUpperCase(Locale.ROOT),
                    request.name().trim(),
                    normalizeDescription(request.description()),
                    id);
        }

        return jdbcTemplate.update(
                """
                        UPDATE departments
                        SET campus_id = ?, dept_code = ?, name = ?
                        WHERE id = ?
                        """,
                request.campusId(),
                request.code().trim().toUpperCase(Locale.ROOT),
                request.name().trim(),
                id);
    }

    private String seedDepartmentSql() {
        return departmentDescriptionColumnPresent
                ? """
                        INSERT INTO departments (tenant_id, campus_id, dept_code, name, description)
                        VALUES (?, ?, ?, ?, ?)
                        """
                : """
                        INSERT INTO departments (tenant_id, campus_id, dept_code, name)
                        VALUES (?, ?, ?, ?)
                        """;
    }

    private String normalizeDescription(String description) {
        return description == null ? "" : description.trim();
    }

    private String formatYearSemester(StudentProfileSnapshot profile) {
        if (profile == null) {
            return "Year 1 / Semester 1";
        }
        if (profile.yearSemester() != null && !profile.yearSemester().isBlank()) {
            return profile.yearSemester().trim().toUpperCase(Locale.ROOT);
        }
        int semester = profile.semester() == null || profile.semester() <= 0 ? 1 : profile.semester();
        return "Semester " + semester;
    }

    private List<String> subjectTemplatesForDepartment(DepartmentDto department) {
        String key = (department.code() + " " + department.name()).toLowerCase(Locale.ROOT);

        for (Map.Entry<String, List<String>> entry : Map.of(
                "cse", List.of("Data Structures", "Operating Systems", "AI Fundamentals", "Cloud Computing"),
                "it", List.of("Web Engineering", "Networks", "DevOps", "Database Systems"),
                "ece", List.of("Signals", "Microprocessors", "Embedded Systems", "Digital Communication"),
                "mech", List.of("Thermodynamics", "Machine Design", "Manufacturing", "Fluid Mechanics"),
                "civil", List.of("Structural Analysis", "Surveying", "Transportation", "Concrete Technology"),
                "eee", List.of("Power Systems", "Control Systems", "Electrical Machines", "Power Electronics")
        ).entrySet()) {
            if (key.contains(entry.getKey())) {
                return entry.getValue();
            }
        }

        return List.of("Core Subject", "Advanced Lab", "Design Project", "Elective");
    }

    private record StudentProfileSnapshot(
            Long userId,
            String pnrNo,
            String rollNo,
            String yearSemester,
            Integer semester
    ) {
    }
}
