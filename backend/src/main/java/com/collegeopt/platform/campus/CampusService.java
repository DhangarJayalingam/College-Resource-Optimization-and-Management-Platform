package com.collegeopt.platform.campus;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Service;

import java.sql.PreparedStatement;
import java.sql.Statement;
import java.util.List;
import java.util.NoSuchElementException;

@Service
public class CampusService {

    private final JdbcTemplate jdbcTemplate;

    private final RowMapper<CampusDto> campusMapper = (rs, rowNum) -> new CampusDto(
            rs.getLong("id"),
            rs.getString("campus_code"),
            rs.getString("name"),
            rs.getString("city"),
            rs.getString("status")
    );

    private final RowMapper<DepartmentDto> departmentMapper = (rs, rowNum) -> new DepartmentDto(
            rs.getLong("id"),
            rs.getLong("campus_id"),
            rs.getString("dept_code"),
            rs.getString("name"),
            ""
    );

    public CampusService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
        seedDefaults();
    }

    public List<CampusDto> listCampuses() {
        return jdbcTemplate.query(
                """
                        SELECT id, campus_code, name, city, status
                        FROM campuses
                        ORDER BY id
                        """,
                campusMapper
        );
    }

    public List<DepartmentDto> listDepartments() {
        return jdbcTemplate.query(
                """
                        SELECT id, campus_id, dept_code, name
                        FROM departments
                        ORDER BY campus_id, dept_code
                        """,
                departmentMapper
        );
    }

    public DepartmentDto getDepartment(Long departmentId) {
        List<DepartmentDto> departments = jdbcTemplate.query(
                """
                        SELECT id, campus_id, dept_code, name
                        FROM departments
                        WHERE id = ?
                        """,
                departmentMapper,
                departmentId
        );

        if (departments.isEmpty()) {
            throw new NoSuchElementException("Department not found");
        }

        return departments.get(0);
    }

    public CampusDto getCampus(Long campusId) {
        List<CampusDto> campuses = jdbcTemplate.query(
                """
                        SELECT id, campus_code, name, city, status
                        FROM campuses
                        WHERE id = ?
                        """,
                campusMapper,
                campusId
        );

        if (campuses.isEmpty()) {
            throw new NoSuchElementException("Campus not found");
        }

        return campuses.get(0);
    }

    public List<DepartmentDto> listDepartmentsByCampus(Long campusId) {
        return jdbcTemplate.query(
                """
                        SELECT id, campus_id, dept_code, name
                        FROM departments
                        WHERE campus_id = ?
                        ORDER BY dept_code
                        """,
                departmentMapper,
                campusId
        );
    }

    public CampusDto addCampus(CampusDto request) {
        KeyHolder keyHolder = new GeneratedKeyHolder();
        jdbcTemplate.update(connection -> {
            PreparedStatement statement = connection.prepareStatement(
                    """
                            INSERT INTO campuses (tenant_id, campus_code, name, city, status)
                            VALUES (?, ?, ?, ?, ?)
                            """,
                    Statement.RETURN_GENERATED_KEYS
            );
            statement.setLong(1, 1L);
            statement.setString(2, request.campusCode());
            statement.setString(3, request.name());
            statement.setString(4, request.city());
            statement.setString(5, request.status());
            return statement;
        }, keyHolder);

        Number key = keyHolder.getKey();
        if (key == null) {
            throw new IllegalStateException("Campus creation failed");
        }

        return new CampusDto(key.longValue(), request.campusCode(), request.name(), request.city(), request.status());
    }

    private void seedDefaults() {
        seedCampus(1L, "MAIN", "Main Campus", "Chennai", "ACTIVE");
        seedCampus(2L, "CITY", "City Campus", "Coimbatore", "ACTIVE");
    }

    private void seedCampus(Long id, String campusCode, String name, String city, String status) {
        Integer count = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM campuses WHERE id = ?",
                Integer.class,
                id
        );

        if (count != null && count > 0) {
            return;
        }

        jdbcTemplate.update(
                """
                        INSERT INTO campuses (id, tenant_id, campus_code, name, city, status)
                        VALUES (?, ?, ?, ?, ?, ?)
                        """,
                id,
                1L,
                campusCode,
                name,
                city,
                status
        );
    }
}
