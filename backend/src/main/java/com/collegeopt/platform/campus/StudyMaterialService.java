package com.collegeopt.platform.campus;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Service;

import java.sql.PreparedStatement;
import java.sql.Statement;
import java.time.LocalDateTime;
import java.util.List;

@Service
public class StudyMaterialService {

    private final JdbcTemplate jdbcTemplate;

    public StudyMaterialService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
        ensureTable();
    }

    public List<StudyMaterialDto> listMaterials() {
        return jdbcTemplate.query(
                """
                        SELECT id, course_code, title, description, file_url, faculty_id, department_id, uploaded_at
                        FROM study_materials
                        ORDER BY uploaded_at DESC, id DESC
                        """,
                (rs, rowNum) -> new StudyMaterialDto(
                        rs.getLong("id"),
                        rs.getString("course_code"),
                        rs.getString("title"),
                        rs.getString("description"),
                        rs.getString("file_url"),
                        rs.getLong("faculty_id"),
                        rs.getLong("department_id"),
                        rs.getTimestamp("uploaded_at").toLocalDateTime()
                )
        );
    }

    public StudyMaterialDto upload(CreateStudyMaterialRequest request) {
        LocalDateTime uploadedAt = LocalDateTime.now();
        KeyHolder keyHolder = new GeneratedKeyHolder();

        jdbcTemplate.update(connection -> {
            PreparedStatement statement = connection.prepareStatement(
                    """
                            INSERT INTO study_materials (
                                course_code, title, description, file_url, faculty_id, department_id, uploaded_at
                            )
                            VALUES (?, ?, ?, ?, ?, ?, ?)
                            """,
                    Statement.RETURN_GENERATED_KEYS
            );
            statement.setString(1, request.courseCode());
            statement.setString(2, request.title());
            statement.setString(3, request.description());
            statement.setString(4, request.fileUrl());
            statement.setLong(5, request.facultyId());
            statement.setLong(6, request.departmentId());
            statement.setTimestamp(7, java.sql.Timestamp.valueOf(uploadedAt));
            return statement;
        }, keyHolder);

        Number id = keyHolder.getKey();
        if (id == null) {
            throw new IllegalStateException("Could not store study material");
        }

        return new StudyMaterialDto(
                id.longValue(),
                request.courseCode(),
                request.title(),
                request.description(),
                request.fileUrl(),
                request.facultyId(),
                request.departmentId(),
                uploadedAt
        );
    }

    private void ensureTable() {
        jdbcTemplate.execute(
                """
                        CREATE TABLE IF NOT EXISTS study_materials (
                            id BIGINT PRIMARY KEY AUTO_INCREMENT,
                            course_code VARCHAR(120) NOT NULL,
                            title VARCHAR(255) NOT NULL,
                            description TEXT NOT NULL,
                            file_url TEXT NOT NULL,
                            faculty_id BIGINT NOT NULL,
                            department_id BIGINT NOT NULL,
                            uploaded_at DATETIME NOT NULL
                        )
                        """
        );
    }
}
