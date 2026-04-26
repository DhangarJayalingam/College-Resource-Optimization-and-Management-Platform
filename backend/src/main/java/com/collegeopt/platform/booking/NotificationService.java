package com.collegeopt.platform.booking;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Service;

import java.sql.PreparedStatement;
import java.sql.Statement;
import java.time.LocalDateTime;
import java.util.List;

@Service
public class NotificationService {

    private final JdbcTemplate jdbcTemplate;

    public NotificationService(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
        ensureTable();
    }

    public BookingNotificationDto notifyUser(Long userId, String title, String message, String type) {
        LocalDateTime createdAt = LocalDateTime.now();
        KeyHolder keyHolder = new GeneratedKeyHolder();

        jdbcTemplate.update(connection -> {
            PreparedStatement statement = connection.prepareStatement(
                    """
                            INSERT INTO booking_notifications (user_id, title, message, type, created_at)
                            VALUES (?, ?, ?, ?, ?)
                            """,
                    Statement.RETURN_GENERATED_KEYS
            );
            statement.setLong(1, userId);
            statement.setString(2, title);
            statement.setString(3, message);
            statement.setString(4, type);
            statement.setTimestamp(5, java.sql.Timestamp.valueOf(createdAt));
            return statement;
        }, keyHolder);

        Number id = keyHolder.getKey();
        if (id == null) {
            throw new IllegalStateException("Could not store notification");
        }

        return new BookingNotificationDto(id.longValue(), userId, title, message, type, createdAt);
    }

    public List<BookingNotificationDto> getNotificationsForUser(Long userId) {
        return jdbcTemplate.query(
                """
                        SELECT id, user_id, title, message, type, created_at
                        FROM booking_notifications
                        WHERE user_id = ?
                        ORDER BY created_at DESC, id DESC
                        """,
                (rs, rowNum) -> new BookingNotificationDto(
                        rs.getLong("id"),
                        rs.getLong("user_id"),
                        rs.getString("title"),
                        rs.getString("message"),
                        rs.getString("type"),
                        rs.getTimestamp("created_at").toLocalDateTime()
                ),
                userId
        );
    }

    private void ensureTable() {
        jdbcTemplate.execute(
                """
                        CREATE TABLE IF NOT EXISTS booking_notifications (
                            id BIGINT PRIMARY KEY AUTO_INCREMENT,
                            user_id BIGINT NOT NULL,
                            title VARCHAR(255) NOT NULL,
                            message TEXT NOT NULL,
                            type VARCHAR(120) NOT NULL,
                            created_at DATETIME NOT NULL
                        )
                        """
        );
    }
}
