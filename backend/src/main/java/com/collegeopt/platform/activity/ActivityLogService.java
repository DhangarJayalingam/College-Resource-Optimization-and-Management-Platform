package com.collegeopt.platform.activity;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Service;

import java.sql.PreparedStatement;
import java.sql.Statement;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class ActivityLogService {

    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper = new ObjectMapper();

    public ActivityLogService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
        ensureTable();
    }

    public List<ActivityLogDto> listLogs() {
        return jdbcTemplate.query(
                """
                        SELECT id, user_id, action, entity_type, entity_id, details, created_at
                        FROM activity_logs
                        ORDER BY created_at DESC, id DESC
                        """,
                (rs, rowNum) -> new ActivityLogDto(
                        rs.getLong("id"),
                        rs.getLong("user_id"),
                        rs.getString("action"),
                        rs.getString("entity_type"),
                        rs.getLong("entity_id"),
                        readDetails(rs.getString("details")),
                        rs.getTimestamp("created_at").toLocalDateTime()
                )
        );
    }

    public List<ActivityLogDto> listLogsForUser(Long userId) {
        return jdbcTemplate.query(
                """
                        SELECT id, user_id, action, entity_type, entity_id, details, created_at
                        FROM activity_logs
                        WHERE user_id = ?
                        ORDER BY created_at DESC, id DESC
                        """,
                (rs, rowNum) -> new ActivityLogDto(
                        rs.getLong("id"),
                        rs.getLong("user_id"),
                        rs.getString("action"),
                        rs.getString("entity_type"),
                        rs.getLong("entity_id"),
                        readDetails(rs.getString("details")),
                        rs.getTimestamp("created_at").toLocalDateTime()
                ),
                userId
        );
    }

    public ActivityLogDto log(CreateActivityLogRequest request) {
        LocalDateTime createdAt = LocalDateTime.now();
        KeyHolder keyHolder = new GeneratedKeyHolder();
        ActivityActorContext actorContext = findActorContext(request.userId());
        boolean hasTenantId = hasColumn("activity_logs", "tenant_id");
        boolean hasCampusId = hasColumn("activity_logs", "campus_id");
        boolean hasIpAddress = hasColumn("activity_logs", "ip_address");

        jdbcTemplate.update(connection -> {
            List<String> columns = new ArrayList<>();
            List<Object> values = new ArrayList<>();

            if (hasTenantId) {
                Long tenantId = actorContext != null ? actorContext.tenantId() : defaultTenantId();
                if (tenantId == null) {
                    throw new IllegalStateException("Could not resolve tenant for activity log");
                }
                columns.add("tenant_id");
                values.add(tenantId);
            }
            if (hasCampusId) {
                columns.add("campus_id");
                values.add(actorContext == null ? null : actorContext.campusId());
            }
            columns.add("user_id");
            values.add(request.userId());
            columns.add("action");
            values.add(request.action());
            columns.add("entity_type");
            values.add(request.entityType());
            columns.add("entity_id");
            values.add(request.entityId());
            columns.add("details");
            values.add(writeDetails(request.details()));
            if (hasIpAddress) {
                columns.add("ip_address");
                values.add(null);
            }
            columns.add("created_at");
            values.add(java.sql.Timestamp.valueOf(createdAt));

            String placeholders = String.join(", ", java.util.Collections.nCopies(values.size(), "?"));
            PreparedStatement statement = connection.prepareStatement(
                    "INSERT INTO activity_logs (" + String.join(", ", columns) + ") VALUES (" + placeholders + ")",
                    Statement.RETURN_GENERATED_KEYS
            );
            for (int index = 0; index < values.size(); index++) {
                statement.setObject(index + 1, values.get(index));
            }
            return statement;
        }, keyHolder);

        Number id = keyHolder.getKey();
        if (id == null) {
            throw new IllegalStateException("Could not store activity log");
        }

        return new ActivityLogDto(
                id.longValue(),
                request.userId(),
                request.action(),
                request.entityType(),
                request.entityId(),
                request.details(),
                createdAt
        );
    }

    private void ensureTable() {
        jdbcTemplate.execute(
                """
                        CREATE TABLE IF NOT EXISTS activity_logs (
                            id BIGINT PRIMARY KEY AUTO_INCREMENT,
                            user_id BIGINT NOT NULL,
                            action VARCHAR(255) NOT NULL,
                            entity_type VARCHAR(120) NOT NULL,
                            entity_id BIGINT NOT NULL,
                            details JSON NULL,
                            created_at DATETIME NOT NULL
                        )
                        """
        );
        Integer detailsColumnCount = jdbcTemplate.queryForObject(
                """
                        SELECT COUNT(*)
                        FROM information_schema.columns
                        WHERE table_schema = DATABASE()
                          AND table_name = 'activity_logs'
                          AND column_name = 'details'
                        """,
                Integer.class
        );
        if (detailsColumnCount == null || detailsColumnCount == 0) {
            jdbcTemplate.execute("ALTER TABLE activity_logs ADD COLUMN details JSON NULL");
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

    private ActivityActorContext findActorContext(Long userId) {
        if (userId == null) {
            return null;
        }
        List<ActivityActorContext> matches = jdbcTemplate.query(
                """
                        SELECT tenant_id, campus_id
                        FROM users
                        WHERE id = ?
                        """,
                (rs, rowNum) -> new ActivityActorContext(
                        rs.getLong("tenant_id"),
                        rs.getObject("campus_id", Long.class)
                ),
                userId
        );
        return matches.isEmpty() ? null : matches.get(0);
    }

    private Long defaultTenantId() {
        List<Long> tenantIds = jdbcTemplate.query(
                "SELECT id FROM tenants ORDER BY id LIMIT 1",
                (rs, rowNum) -> rs.getLong("id")
        );
        return tenantIds.isEmpty() ? null : tenantIds.get(0);
    }

    private String writeDetails(Map<String, Object> details) {
        try {
            return objectMapper.writeValueAsString(details == null ? Map.of() : details);
        } catch (Exception ex) {
            throw new IllegalStateException("Could not serialize activity log details", ex);
        }
    }

    private Map<String, Object> readDetails(String json) {
        if (json == null || json.isBlank()) {
            return Map.of();
        }

        try {
            return objectMapper.readValue(json, new TypeReference<LinkedHashMap<String, Object>>() {});
        } catch (Exception ex) {
            return Map.of();
        }
    }

    private record ActivityActorContext(Long tenantId, Long campusId) {
    }
}
