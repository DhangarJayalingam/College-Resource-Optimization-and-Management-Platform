package com.collegeopt.platform.user;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.sql.PreparedStatement;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

@Service
public class UserDirectoryService {

    private static final long DEFAULT_TENANT_ID = 1L;
    private static final long DEFAULT_CAMPUS_ID = 1L;
    private static final long DEFAULT_DEPARTMENT_ID = 1L;

    private final JdbcTemplate jdbcTemplate;
    private final RowMapper<AppUser> baseUserMapper = (rs, rowNum) -> new AppUser(
            rs.getLong("id"),
            rs.getLong("tenant_id"),
            rs.getLong("campus_id"),
            rs.getLong("department_id"),
            rs.getString("full_name"),
            rs.getString("email"),
            rs.getString("password_hash"),
            EnumSet.noneOf(RoleType.class),
            rs.getLong("session_version"));

    public UserDirectoryService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
        ensureExtendedUserSchema();
        ensureStudentProfileSchema();
        seed();
    }

    public Optional<AppUser> findByEmail(String email) {
        String normalizedEmail = normalizeEmail(email);
        if (normalizedEmail == null) {
            return Optional.empty();
        }

        List<AppUser> users = jdbcTemplate.query(
                """
                        SELECT id, tenant_id, campus_id, department_id, full_name, email, password_hash, session_version
                        FROM users
                        WHERE LOWER(email) = ?
                        """,
                baseUserMapper,
                normalizedEmail);

        if (users.isEmpty()) {
            return Optional.empty();
        }

        AppUser user = users.get(0);
        return Optional.of(withRoles(user));
    }

    public List<AppUser> listUsers() {
        return enrichWithRoles(jdbcTemplate.query(
                """
                        SELECT id, tenant_id, campus_id, department_id, full_name, email, password_hash, session_version
                        FROM users
                        ORDER BY id
                        """,
                baseUserMapper));
    }

    @Transactional
    public AppUser register(String fullName, String email, String passwordHash, Set<RoleType> roles,
            Long tenantId, Long campusId) {
        return register(fullName, email, passwordHash, roles, tenantId, campusId, DEFAULT_DEPARTMENT_ID);
    }

    @Transactional
    public AppUser register(String fullName, String email, String passwordHash, Set<RoleType> roles,
            Long tenantId, Long campusId, Long departmentId) {
        return register(fullName, email, passwordHash, roles, tenantId, campusId, departmentId, null, null, null);
    }

    @Transactional
    public AppUser register(String fullName, String email, String passwordHash, Set<RoleType> roles,
            Long tenantId, Long campusId, Long departmentId, String pnrNo, String rollNo, String yearSemester) {
        String normalizedEmail = Objects.requireNonNull(normalizeEmail(email), "email must not be blank");
        if (existsByEmail(normalizedEmail)) {
            throw new IllegalArgumentException("Email already exists");
        }
        if (roles.contains(RoleType.COLLEGE_ADMIN) && hasCollegeAdminForDepartment(departmentId)) {
            throw new IllegalArgumentException("This department already has an assigned admin");
        }

        KeyHolder keyHolder = new GeneratedKeyHolder();
        jdbcTemplate.update(connection -> {
            PreparedStatement statement = connection.prepareStatement(
                    """
                            INSERT INTO users (
                                tenant_id, campus_id, department_id, user_code, full_name, email, password_hash, status, session_version
                            ) VALUES (?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?)
                            """,
                    Statement.RETURN_GENERATED_KEYS);
            statement.setLong(1, tenantId);
            statement.setObject(2, campusId);
            statement.setObject(3, departmentId);
            statement.setString(4, generateUserCode());
            statement.setString(5, fullName);
            statement.setString(6, normalizedEmail);
            statement.setString(7, passwordHash);
            statement.setLong(8, 1L);
            return statement;
        }, keyHolder);

        Number generatedId = keyHolder.getKey();
        if (generatedId == null) {
            throw new IllegalStateException("Failed to create user");
        }

        long userId = generatedId.longValue();
        for (RoleType role : roles) {
            Long roleId = findRoleId(role);
            jdbcTemplate.update(
                    """
                            INSERT INTO user_roles (user_id, role_id)
                            VALUES (?, ?)
                            """,
                    userId,
                    roleId);
        }

        if (roles.contains(RoleType.STUDENT)) {
            upsertStudentProfile(userId, pnrNo, rollNo, yearSemester);
        }

        return getUser(userId);
    }

    @Transactional
    public void updatePassword(String email, String passwordHash) {
        String normalizedEmail = Objects.requireNonNull(normalizeEmail(email), "email must not be blank");
        int updated = jdbcTemplate.update(
                """
                        UPDATE users
                        SET password_hash = ?, updated_at = CURRENT_TIMESTAMP
                        WHERE LOWER(email) = ?
                        """,
                passwordHash,
                normalizedEmail);
        if (updated == 0) {
            throw new IllegalArgumentException("User not found");
        }
    }

    @Transactional
    public AppUser updateProfile(Long userId, String fullName, String email, Long departmentId) {
        AppUser existing = getUser(userId);
        String normalizedEmail = Objects.requireNonNull(normalizeEmail(email), "email must not be blank");
        if (!normalizedEmail.equalsIgnoreCase(existing.email()) && existsByEmail(normalizedEmail)) {
            throw new IllegalArgumentException("Email already exists");
        }

        jdbcTemplate.update(
                """
                        UPDATE users
                        SET full_name = ?, email = ?, department_id = ?, updated_at = CURRENT_TIMESTAMP
                        WHERE id = ?
                        """,
                fullName.trim(),
                normalizedEmail,
                departmentId,
                userId
        );
        return getUser(userId);
    }

    public boolean matchesPassword(String email, String rawPassword, org.springframework.security.crypto.password.PasswordEncoder passwordEncoder) {
        AppUser user = findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        return passwordEncoder.matches(rawPassword, user.passwordHash());
    }

    @Transactional
    public void incrementSessionVersion(Long userId) {
        jdbcTemplate.update(
                """
                        UPDATE users
                        SET session_version = COALESCE(session_version, 1) + 1,
                            updated_at = CURRENT_TIMESTAMP
                        WHERE id = ?
                        """,
                userId
        );
    }

    public Long getSessionVersion(String email) {
        return findByEmail(email)
                .map(AppUser::sessionVersion)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
    }

    @Transactional
    public AppUser findOrCreateSocialUser(String fullName, String email, String passwordHash, RoleType roleType) {
        return findByEmail(email)
                .orElseGet(() -> register(fullName, email, passwordHash, EnumSet.of(roleType), DEFAULT_TENANT_ID,
                        DEFAULT_CAMPUS_ID, DEFAULT_DEPARTMENT_ID));
    }

    public boolean existsByEmail(String email) {
        String normalizedEmail = normalizeEmail(email);
        if (normalizedEmail == null) {
            return false;
        }

        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM users WHERE LOWER(email) = ?",
                Integer.class,
                normalizedEmail);
        return count != null && count > 0;
    }

    public AppUser getUser(Long userId) {
        List<AppUser> users = jdbcTemplate.query(
                """
                        SELECT id, tenant_id, campus_id, department_id, full_name, email, password_hash, session_version
                        FROM users
                        WHERE id = ?
                        """,
                baseUserMapper,
                userId);

        if (users.isEmpty()) {
            throw new IllegalArgumentException("User not found");
        }

        return withRoles(users.get(0));
    }

    public List<AppUser> listFacultyByDepartment(Long departmentId) {
        return listUsersByRoleAndDepartment(RoleType.FACULTY, departmentId);
    }

    public List<AppUser> listTeachingStaffByDepartment(Long departmentId) {
        return listUsersByRolesAndDepartment(List.of(RoleType.FACULTY, RoleType.COLLEGE_ADMIN), departmentId);
    }

    public List<AppUser> listStudentsByDepartment(Long departmentId) {
        return listUsersByRoleAndDepartment(RoleType.STUDENT, departmentId);
    }

    public List<AppUser> listAdmins() {
        return listUsersByRole(RoleType.COLLEGE_ADMIN);
    }

    public boolean hasCollegeAdminForDepartment(Long departmentId) {
        return hasCollegeAdminForDepartment(departmentId, null);
    }

    public boolean hasCollegeAdminForDepartment(Long departmentId, Long excludeUserId) {
        if (departmentId == null) {
            return false;
        }
        String sql = """
                SELECT COUNT(*)
                FROM users u
                JOIN user_roles ur ON ur.user_id = u.id
                JOIN roles r ON r.id = ur.role_id
                WHERE r.role_name = ? AND u.department_id = ?
                """ + (excludeUserId != null ? " AND u.id <> ?" : "");
        Integer count = excludeUserId != null
                ? jdbcTemplate.queryForObject(sql, Integer.class, RoleType.COLLEGE_ADMIN.name(), departmentId, excludeUserId)
                : jdbcTemplate.queryForObject(sql, Integer.class, RoleType.COLLEGE_ADMIN.name(), departmentId);
        return count != null && count > 0;
    }

    @Transactional
    public AppUser assignCollegeAdmin(Long userId, Long departmentId) {
        AppUser user = getUser(userId);
        if (user.roles().contains(RoleType.SUPER_ADMIN)) {
            throw new IllegalArgumentException("Superadmin cannot be assigned as department admin");
        }
        if (hasCollegeAdminForDepartment(departmentId, userId)) {
            throw new IllegalArgumentException("Selected department already has an assigned admin");
        }

        Long campusId = jdbcTemplate.queryForObject(
                "SELECT campus_id FROM departments WHERE id = ?",
                Long.class,
                departmentId);
        if (campusId == null) {
            throw new IllegalArgumentException("Department not found");
        }

        jdbcTemplate.update(
                """
                        UPDATE users
                        SET campus_id = ?, department_id = ?, updated_at = CURRENT_TIMESTAMP
                        WHERE id = ?
                        """,
                campusId,
                departmentId,
                userId);

        Long roleId = findRoleId(RoleType.COLLEGE_ADMIN);
        Integer roleCount = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM user_roles WHERE user_id = ? AND role_id = ?",
                Integer.class,
                userId,
                roleId);
        if (roleCount == null || roleCount == 0) {
            jdbcTemplate.update(
                    """
                            INSERT INTO user_roles (user_id, role_id)
                            VALUES (?, ?)
                            """,
                    userId,
                    roleId);
        }

        return getUser(userId);
    }

    public List<AppUser> listUsersByDepartment(Long departmentId) {
        return enrichWithRoles(jdbcTemplate.query(
                """
                        SELECT id, tenant_id, campus_id, department_id, full_name, email, password_hash, session_version
                        FROM users
                        WHERE department_id = ?
                        ORDER BY id
                        """,
                baseUserMapper,
                departmentId));
    }

    @Transactional
    public void deleteByEmail(String email) {
        String normalizedEmail = Objects.requireNonNull(normalizeEmail(email), "email must not be blank");
        AppUser existing = findByEmail(normalizedEmail)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
        deleteById(existing.id());
    }

    @Transactional
    public void deleteById(Long userId) {
        AppUser existing = getUser(userId);
        purgeUserReferences(existing.id());
        jdbcTemplate.update("DELETE FROM student_profiles WHERE user_id = ?", existing.id());
        jdbcTemplate.update("DELETE FROM faculty_profiles WHERE user_id = ?", existing.id());
        jdbcTemplate.update("DELETE FROM user_roles WHERE user_id = ?", existing.id());
        jdbcTemplate.update("DELETE FROM users WHERE id = ?", existing.id());
    }

    @Transactional
    public void seed() {
        seedReferenceData();
    }

    private void seedReferenceData() {
        jdbcTemplate.update(
                """
                        INSERT INTO tenants (id, code, name, status)
                        SELECT 1, 'DEFAULT', 'CollegeOpt Default Tenant', 'ACTIVE'
                        WHERE NOT EXISTS (SELECT 1 FROM tenants WHERE id = 1)
                        """);

        jdbcTemplate.update(
                """
                        INSERT INTO campuses (id, tenant_id, campus_code, name, city, state, country, status)
                        SELECT 1, 1, 'MAIN', 'Main Campus', 'Chennai', 'Tamil Nadu', 'India', 'ACTIVE'
                        WHERE NOT EXISTS (SELECT 1 FROM campuses WHERE id = 1)
                        """);

        jdbcTemplate.update(
                """
                        INSERT INTO campuses (id, tenant_id, campus_code, name, city, state, country, status)
                        SELECT 2, 1, 'CITY', 'City Campus', 'Coimbatore', 'Tamil Nadu', 'India', 'ACTIVE'
                        WHERE NOT EXISTS (SELECT 1 FROM campuses WHERE id = 2)
                        """);

        jdbcTemplate.update(
                """
                        INSERT INTO departments (id, tenant_id, campus_id, dept_code, name)
                        SELECT 1, 1, 1, 'CSE', 'Computer Science'
                        WHERE NOT EXISTS (SELECT 1 FROM departments WHERE id = 1)
                        """);

        jdbcTemplate.update(
                """
                        INSERT INTO departments (id, tenant_id, campus_id, dept_code, name)
                        SELECT 2, 1, 1, 'ECE', 'Electronics and Communication'
                        WHERE NOT EXISTS (SELECT 1 FROM departments WHERE id = 2)
                        """);

        jdbcTemplate.update(
                """
                        INSERT INTO departments (id, tenant_id, campus_id, dept_code, name)
                        SELECT 3, 1, 2, 'MECH', 'Mechanical Engineering'
                        WHERE NOT EXISTS (SELECT 1 FROM departments WHERE id = 3)
                        """);

        seedRole(RoleType.SUPER_ADMIN, "Global platform owner with full control");
        seedRole(RoleType.COLLEGE_ADMIN, "Campus and department operations manager");
        seedRole(RoleType.FACULTY, "Faculty user with timetable and request permissions");
        seedRole(RoleType.STUDENT, "Student user with read-only timetable and materials access");
    }

    private void seedRole(RoleType role, String description) {
        jdbcTemplate.update(
                """
                        INSERT INTO roles (role_name, description)
                        SELECT ?, ?
                        WHERE NOT EXISTS (SELECT 1 FROM roles WHERE role_name = ?)
                        """,
                role.name(),
                description,
                role.name());
    }

    private List<AppUser> listUsersByRole(RoleType role) {
        return enrichWithRoles(jdbcTemplate.query(
                """
                        SELECT DISTINCT u.id, u.tenant_id, u.campus_id, u.department_id, u.full_name, u.email, u.password_hash, u.session_version
                        FROM users u
                        JOIN user_roles ur ON ur.user_id = u.id
                        JOIN roles r ON r.id = ur.role_id
                        WHERE r.role_name = ?
                        ORDER BY u.id
                        """,
                baseUserMapper,
                role.name()));
    }

    private List<AppUser> listUsersByRoleAndDepartment(RoleType role, Long departmentId) {
        return enrichWithRoles(jdbcTemplate.query(
                """
                        SELECT DISTINCT u.id, u.tenant_id, u.campus_id, u.department_id, u.full_name, u.email, u.password_hash, u.session_version
                        FROM users u
                        JOIN user_roles ur ON ur.user_id = u.id
                        JOIN roles r ON r.id = ur.role_id
                        WHERE r.role_name = ? AND u.department_id = ?
                        ORDER BY u.id
                        """,
                baseUserMapper,
                role.name(),
                departmentId));
    }

    private List<AppUser> listUsersByRolesAndDepartment(List<RoleType> roles, Long departmentId) {
        if (roles == null || roles.isEmpty()) {
            return List.of();
        }

        String placeholders = String.join(", ", java.util.Collections.nCopies(roles.size(), "?"));
        Object[] params = new Object[roles.size() + 1];
        for (int index = 0; index < roles.size(); index++) {
            params[index] = roles.get(index).name();
        }
        params[roles.size()] = departmentId;

        return enrichWithRoles(jdbcTemplate.query(
                """
                        SELECT DISTINCT u.id, u.tenant_id, u.campus_id, u.department_id, u.full_name, u.email, u.password_hash, u.session_version
                        FROM users u
                        JOIN user_roles ur ON ur.user_id = u.id
                        JOIN roles r ON r.id = ur.role_id
                        WHERE r.role_name IN ("""
                        + placeholders +
                        """
                        ) AND u.department_id = ?
                        ORDER BY u.id
                        """,
                baseUserMapper,
                params));
    }

    private AppUser withRoles(AppUser user) {
        List<RoleType> userRoles = loadRolesForUserIds(List.of(user.id())).getOrDefault(user.id(), List.of());
        Set<RoleType> roles = userRoles.isEmpty() ? EnumSet.noneOf(RoleType.class) : EnumSet.copyOf(userRoles);
        return new AppUser(
                user.id(),
                user.tenantId(),
                user.campusId(),
                user.departmentId(),
                user.fullName(),
                user.email(),
                user.passwordHash(),
                roles,
                user.sessionVersion());
    }

    private List<AppUser> enrichWithRoles(List<AppUser> users) {
        if (users.isEmpty()) {
            return List.of();
        }

        List<Long> userIds = users.stream().map(AppUser::id).toList();
        Map<Long, List<RoleType>> rolesByUserId = loadRolesForUserIds(userIds);
        List<AppUser> enriched = new ArrayList<>(users.size());

        for (AppUser user : users) {
            List<RoleType> userRoles = rolesByUserId.getOrDefault(user.id(), List.of());
            Set<RoleType> roles = userRoles.isEmpty() ? EnumSet.noneOf(RoleType.class) : EnumSet.copyOf(userRoles);
            enriched.add(new AppUser(
                    user.id(),
                    user.tenantId(),
                    user.campusId(),
                    user.departmentId(),
                    user.fullName(),
                    user.email(),
                    user.passwordHash(),
                    roles,
                    user.sessionVersion()));
        }

        return enriched;
    }

    private Map<Long, List<RoleType>> loadRolesForUserIds(List<Long> userIds) {
        String placeholders = String.join(",", userIds.stream().map(id -> "?").toList());
        List<Map<String, Object>> rows = jdbcTemplate.queryForList(
                """
                        SELECT ur.user_id, r.role_name
                        FROM user_roles ur
                        JOIN roles r ON r.id = ur.role_id
                        WHERE ur.user_id IN (%s)
                        ORDER BY ur.user_id
                        """.formatted(placeholders),
                userIds.toArray());

        Map<Long, List<RoleType>> rolesByUserId = new HashMap<>();
        for (Map<String, Object> row : rows) {
            Long userId = ((Number) row.get("user_id")).longValue();
            RoleType role = RoleType.valueOf((String) row.get("role_name"));
            rolesByUserId.computeIfAbsent(userId, ignored -> new ArrayList<>()).add(role);
        }
        return rolesByUserId;
    }

    private Long findRoleId(RoleType role) {
        Long roleId = jdbcTemplate.queryForObject(
                "SELECT id FROM roles WHERE role_name = ?",
                Long.class,
                role.name());
        if (roleId == null) {
            throw new IllegalStateException("Role not found: " + role.name());
        }
        return roleId;
    }

    private String generateUserCode() {
        return "USR-" + UUID.randomUUID().toString().replace("-", "").substring(0, 8).toUpperCase();
    }

    private String normalizeEmail(String email) {
        if (email == null) {
            return null;
        }
        String normalized = email.trim().toLowerCase();
        return normalized.isBlank() ? null : normalized;
    }

    private void ensureExtendedUserSchema() {
        Integer sessionVersionCount = jdbcTemplate.queryForObject(
                """
                        SELECT COUNT(*)
                        FROM information_schema.columns
                        WHERE table_schema = DATABASE()
                          AND table_name = 'users'
                          AND column_name = 'session_version'
                        """,
                Integer.class
        );
        if (sessionVersionCount == null || sessionVersionCount == 0) {
            jdbcTemplate.execute("ALTER TABLE users ADD COLUMN session_version BIGINT NOT NULL DEFAULT 1");
        }
    }

    private void purgeUserReferences(Long userId) {
        deleteIfTableExists("user_preferences", "DELETE FROM user_preferences WHERE user_id = ?", userId);

        updateIfColumnExists("student_profiles", "advisor_user_id",
                "UPDATE student_profiles SET advisor_user_id = NULL WHERE advisor_user_id = ?",
                userId);
        deleteIfColumnExists("student_profiles", "user_id", "DELETE FROM student_profiles WHERE user_id = ?", userId);
        deleteIfColumnExists("faculty_profiles", "user_id", "DELETE FROM faculty_profiles WHERE user_id = ?", userId);

        deleteIfColumnExists("activity_logs", "user_id", "DELETE FROM activity_logs WHERE user_id = ?", userId);
        deleteIfColumnExists("booking_notifications", "user_id", "DELETE FROM booking_notifications WHERE user_id = ?", userId);
        deleteIfColumnExists("study_materials", "uploaded_by_user_id", "DELETE FROM study_materials WHERE uploaded_by_user_id = ?", userId);
        deleteIfColumnExists("announcements", "created_by_user_id", "DELETE FROM announcements WHERE created_by_user_id = ?", userId);
        deleteIfColumnExists("app_announcements", "created_by_user_id", "DELETE FROM app_announcements WHERE created_by_user_id = ?", userId);
        deleteIfColumnExists("maintenance_items", "reported_by", "DELETE FROM maintenance_items WHERE reported_by = ?", userId);
        updateIfColumnExists("maintenance_items", "assigned_to_user_id",
                "UPDATE maintenance_items SET assigned_to_user_id = NULL WHERE assigned_to_user_id = ?",
                userId);
        deleteIfColumnExists("faculty_availability", "faculty_user_id", "DELETE FROM faculty_availability WHERE faculty_user_id = ?", userId);
        deleteIfColumnExists("timetable_entries", "faculty_user_id", "DELETE FROM timetable_entries WHERE faculty_user_id = ?", userId);
        deleteIfColumnExists("app_timetable_entries", "faculty_user_id", "DELETE FROM app_timetable_entries WHERE faculty_user_id = ?", userId);

        deleteRequestLinkedRows("resource_request_items", "request_id", "resource_requests", "requester_user_id", userId);
        deleteRequestLinkedRows("app_facility_bookings", "request_id", "resource_requests", "requester_user_id", userId);
        deleteRequestLinkedRows("facility_bookings", "request_id", "resource_requests", "requester_user_id", userId);

        updateIfColumnExists("resource_requests", "approved_by_user_id",
                "UPDATE resource_requests SET approved_by_user_id = NULL WHERE approved_by_user_id = ?",
                userId);
        deleteIfColumnExists("resource_requests", "requester_user_id", "DELETE FROM resource_requests WHERE requester_user_id = ?", userId);

        deleteBookingLinkedRows(userId);

        deleteIfColumnExists("booking_approval_history", "actor_user_id",
                "DELETE FROM booking_approval_history WHERE actor_user_id = ?",
                userId);
        updateIfColumnExists("bookings", "approved_by",
                "UPDATE bookings SET approved_by = NULL, approved_at = NULL WHERE approved_by = ?",
                userId);
        deleteIfColumnExists("bookings", "user_id", "DELETE FROM bookings WHERE user_id = ?", userId);
    }

    private void deleteBookingLinkedRows(Long userId) {
        if (!tableExists("bookings") || !tableHasColumn("bookings", "user_id")) {
            return;
        }
        if (tableExists("booking_approval_history") && tableHasColumn("booking_approval_history", "booking_id")) {
            jdbcTemplate.update(
                    """
                            DELETE FROM booking_approval_history
                            WHERE booking_id IN (SELECT id FROM bookings WHERE user_id = ?)
                            """,
                    userId
            );
        }
    }

    private void deleteRequestLinkedRows(String childTable, String childColumn, String parentTable, String parentUserColumn, Long userId) {
        if (!tableExists(childTable) || !tableHasColumn(childTable, childColumn) || !tableExists(parentTable) || !tableHasColumn(parentTable, parentUserColumn)) {
            return;
        }
        jdbcTemplate.update(
                ("DELETE FROM " + childTable + " WHERE " + childColumn + " IN (SELECT id FROM " + parentTable + " WHERE " + parentUserColumn + " = ?)"),
                userId
        );
    }

    private void deleteIfTableExists(String tableName, String sql, Object... args) {
        if (!tableExists(tableName)) {
            return;
        }
        jdbcTemplate.update(sql, args);
    }

    private void deleteIfColumnExists(String tableName, String columnName, String sql, Object... args) {
        if (!tableExists(tableName) || !tableHasColumn(tableName, columnName)) {
            return;
        }
        jdbcTemplate.update(sql, args);
    }

    private void updateIfColumnExists(String tableName, String columnName, String sql, Object... args) {
        if (!tableExists(tableName) || !tableHasColumn(tableName, columnName)) {
            return;
        }
        jdbcTemplate.update(sql, args);
    }

    private boolean tableExists(String tableName) {
        Integer count = jdbcTemplate.queryForObject(
                """
                        SELECT COUNT(*)
                        FROM information_schema.tables
                        WHERE table_schema = DATABASE()
                          AND table_name = ?
                        """,
                Integer.class,
                tableName
        );
        return count != null && count > 0;
    }

    private boolean tableHasColumn(String tableName, String columnName) {
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

    private void ensureStudentProfileSchema() {
        jdbcTemplate.execute("""
                CREATE TABLE IF NOT EXISTS student_profiles (
                    id BIGINT PRIMARY KEY AUTO_INCREMENT,
                    user_id BIGINT NOT NULL UNIQUE,
                    semester INT NOT NULL DEFAULT 1,
                    section_name VARCHAR(20),
                    advisor_user_id BIGINT,
                    pnr_no VARCHAR(100),
                    roll_no VARCHAR(100),
                    year_semester VARCHAR(20),
                    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                )
                """);

        ensureStudentProfileColumn("pnr_no", "ALTER TABLE student_profiles ADD COLUMN pnr_no VARCHAR(100) NULL");
        ensureStudentProfileColumn("roll_no", "ALTER TABLE student_profiles ADD COLUMN roll_no VARCHAR(100) NULL");
        ensureStudentProfileColumn("year_semester", "ALTER TABLE student_profiles ADD COLUMN year_semester VARCHAR(20) NULL");
    }

    private void ensureStudentProfileColumn(String columnName, String alterSql) {
        Integer count = jdbcTemplate.queryForObject(
                """
                        SELECT COUNT(*)
                        FROM information_schema.columns
                        WHERE table_schema = DATABASE()
                          AND table_name = 'student_profiles'
                          AND column_name = ?
                        """,
                Integer.class,
                columnName
        );
        if (count == null || count == 0) {
            jdbcTemplate.execute(alterSql);
        }
    }

    private void upsertStudentProfile(Long userId, String pnrNo, String rollNo, String yearSemester) {
        String normalizedYearSemester = normalizeYearSemester(yearSemester);
        Integer semester = toSemesterNumber(normalizedYearSemester);

        Integer existingCount = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM student_profiles WHERE user_id = ?",
                Integer.class,
                userId
        );

        if (existingCount != null && existingCount > 0) {
            jdbcTemplate.update(
                    """
                            UPDATE student_profiles
                            SET semester = ?, pnr_no = ?, roll_no = ?, year_semester = ?, updated_at = CURRENT_TIMESTAMP
                            WHERE user_id = ?
                            """,
                    semester,
                    normalizeOptionalValue(pnrNo),
                    normalizeOptionalValue(rollNo),
                    normalizedYearSemester,
                    userId
            );
            return;
        }

        jdbcTemplate.update(
                """
                        INSERT INTO student_profiles (user_id, semester, pnr_no, roll_no, year_semester)
                        VALUES (?, ?, ?, ?, ?)
                        """,
                userId,
                semester,
                normalizeOptionalValue(pnrNo),
                normalizeOptionalValue(rollNo),
                normalizedYearSemester
        );
    }

    private String normalizeYearSemester(String yearSemester) {
        String normalized = normalizeOptionalValue(yearSemester);
        if (normalized == null) {
            return "FE";
        }

        String upper = normalized.toUpperCase();
        if (!List.of("FE", "SE", "TE", "BE").contains(upper)) {
            throw new IllegalArgumentException("Year must be FE, SE, TE, or BE");
        }
        return upper;
    }

    private Integer toSemesterNumber(String yearSemester) {
        return switch (yearSemester) {
            case "FE" -> 1;
            case "SE" -> 3;
            case "TE" -> 5;
            case "BE" -> 7;
            default -> 1;
        };
    }

    private String normalizeOptionalValue(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isBlank() ? null : trimmed;
    }
}
