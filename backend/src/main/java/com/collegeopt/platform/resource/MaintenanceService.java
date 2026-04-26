package com.collegeopt.platform.resource;

import com.collegeopt.platform.activity.ActivityLogService;
import com.collegeopt.platform.activity.CreateActivityLogRequest;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Service;

import java.sql.PreparedStatement;
import java.sql.Statement;
import java.util.List;
import java.util.Map;

@Service
public class MaintenanceService {

    private final JdbcTemplate jdbcTemplate;
    private final ActivityLogService activityLogService;

    public MaintenanceService(JdbcTemplate jdbcTemplate, ActivityLogService activityLogService) {
        this.jdbcTemplate = jdbcTemplate;
        this.activityLogService = activityLogService;
        ensureTable();
    }

    public List<MaintenanceDto> listAll() {
        return jdbcTemplate.query(
                """
                        SELECT id, resource_id, equipment_id, reported_by, issue_description, status,
                               scheduled_date, completed_date
                        FROM maintenance_items
                        ORDER BY id DESC
                        """,
                (rs, rowNum) -> new MaintenanceDto(
                        rs.getLong("id"),
                        rs.getObject("resource_id", Long.class),
                        rs.getObject("equipment_id", Long.class),
                        rs.getLong("reported_by"),
                        rs.getString("issue_description"),
                        rs.getString("status"),
                        rs.getObject("scheduled_date", java.time.LocalDate.class),
                        rs.getObject("completed_date", java.time.LocalDate.class)
                )
        );
    }

    public List<MaintenanceDto> listByResource(Long resourceId) {
        return jdbcTemplate.query(
                """
                        SELECT id, resource_id, equipment_id, reported_by, issue_description, status,
                               scheduled_date, completed_date
                        FROM maintenance_items
                        WHERE resource_id = ? OR equipment_id = ?
                        ORDER BY id DESC
                        """,
                (rs, rowNum) -> new MaintenanceDto(
                        rs.getLong("id"),
                        rs.getObject("resource_id", Long.class),
                        rs.getObject("equipment_id", Long.class),
                        rs.getLong("reported_by"),
                        rs.getString("issue_description"),
                        rs.getString("status"),
                        rs.getObject("scheduled_date", java.time.LocalDate.class),
                        rs.getObject("completed_date", java.time.LocalDate.class)
                ),
                resourceId,
                resourceId
        );
    }

    public MaintenanceDto create(CreateMaintenanceRequest request) {
        KeyHolder keyHolder = new GeneratedKeyHolder();

        jdbcTemplate.update(connection -> {
            PreparedStatement statement = connection.prepareStatement(
                    """
                            INSERT INTO maintenance_items (
                                resource_id, equipment_id, reported_by, issue_description, status,
                                scheduled_date, completed_date
                            )
                            VALUES (?, ?, ?, ?, ?, ?, ?)
                            """,
                    Statement.RETURN_GENERATED_KEYS
            );
            if (request.resourceId() == null) {
                statement.setNull(1, java.sql.Types.BIGINT);
            } else {
                statement.setLong(1, request.resourceId());
            }
            if (request.equipmentId() == null) {
                statement.setNull(2, java.sql.Types.BIGINT);
            } else {
                statement.setLong(2, request.equipmentId());
            }
            statement.setLong(3, request.reportedBy());
            statement.setString(4, request.issueDescription());
            statement.setString(5, request.status().toUpperCase());
            if (request.scheduledDate() == null) {
                statement.setNull(6, java.sql.Types.DATE);
            } else {
                statement.setObject(6, request.scheduledDate());
            }
            if (request.completedDate() == null) {
                statement.setNull(7, java.sql.Types.DATE);
            } else {
                statement.setObject(7, request.completedDate());
            }
            return statement;
        }, keyHolder);

        Number id = keyHolder.getKey();
        if (id == null) {
            throw new IllegalStateException("Could not store maintenance item");
        }

        MaintenanceDto dto = new MaintenanceDto(
                id.longValue(),
                request.resourceId(),
                request.equipmentId(),
                request.reportedBy(),
                request.issueDescription(),
                request.status().toUpperCase(),
                request.scheduledDate(),
                request.completedDate()
        );

        activityLogService.log(new CreateActivityLogRequest(
                request.reportedBy(),
                "Equipment maintenance scheduled",
                "MAINTENANCE",
                dto.id(),
                Map.of(
                        "resourceId", request.resourceId(),
                        "equipmentId", request.equipmentId(),
                        "status", dto.status()
                )
        ));

        return dto;
    }

    private void ensureTable() {
        jdbcTemplate.execute(
                """
                        CREATE TABLE IF NOT EXISTS maintenance_items (
                            id BIGINT PRIMARY KEY AUTO_INCREMENT,
                            resource_id BIGINT NULL,
                            equipment_id BIGINT NULL,
                            reported_by BIGINT NOT NULL,
                            issue_description TEXT NOT NULL,
                            status VARCHAR(80) NOT NULL,
                            scheduled_date DATE NULL,
                            completed_date DATE NULL
                        )
                        """
        );
    }
}
