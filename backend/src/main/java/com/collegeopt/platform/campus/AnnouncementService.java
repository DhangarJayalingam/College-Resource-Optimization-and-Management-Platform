package com.collegeopt.platform.campus;

import com.collegeopt.platform.user.AppUser;
import com.collegeopt.platform.user.RoleType;
import com.collegeopt.platform.user.UserDirectoryService;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.support.GeneratedKeyHolder;
import org.springframework.jdbc.support.KeyHolder;
import org.springframework.stereotype.Service;

import java.sql.PreparedStatement;
import java.sql.Statement;
import java.time.LocalDateTime;
import java.util.List;

@Service
public class AnnouncementService {

    private final JdbcTemplate jdbcTemplate;
    private final UserDirectoryService userDirectoryService;
    private final AnnouncementEmailService announcementEmailService;

    public AnnouncementService(JdbcTemplate jdbcTemplate,
                               UserDirectoryService userDirectoryService,
                               AnnouncementEmailService announcementEmailService) {
        this.jdbcTemplate = jdbcTemplate;
        this.userDirectoryService = userDirectoryService;
        this.announcementEmailService = announcementEmailService;
        ensureTable();
    }

    public List<AnnouncementDto> listAnnouncements() {
        return jdbcTemplate.query(
                """
                        SELECT id, title, content, audience, created_by_user_id, department_id, recipient_email,
                               email_delivery_status, published_at, attachment_url, attachment_type, file_name
                        FROM app_announcements
                        ORDER BY published_at DESC, id DESC
                        """,
                (rs, rowNum) -> new AnnouncementDto(
                        rs.getLong("id"),
                        rs.getString("title"),
                        rs.getString("content"),
                        rs.getString("audience"),
                        rs.getLong("created_by_user_id"),
                        rs.getObject("department_id", Long.class),
                        rs.getString("recipient_email"),
                        rs.getString("email_delivery_status"),
                        rs.getTimestamp("published_at").toLocalDateTime(),
                        rs.getString("attachment_url"),
                        rs.getString("attachment_type"),
                        rs.getString("file_name")
                )
        );
    }

    public List<AnnouncementDto> listAnnouncementsForUser(AppUser currentUser) {
        return listAnnouncements().stream()
                .filter(announcement -> canAccessAnnouncement(announcement, currentUser))
                .toList();
    }

    public AnnouncementDto createAnnouncement(CreateAnnouncementRequest request) {
        String audience = request.audience().toUpperCase();
        String normalizedRecipientEmail = normalizeEmail(request.recipientEmail());

        if ("SPECIFIC_USER".equals(audience)) {
            if (normalizedRecipientEmail == null) {
                throw new IllegalArgumentException("Recipient email is required for a specific user announcement.");
            }
            if (!userDirectoryService.existsByEmail(normalizedRecipientEmail)) {
                throw new IllegalArgumentException("Recipient email does not exist in the application.");
            }
        }
        final String recipientEmail = "SPECIFIC_USER".equals(audience) ? normalizedRecipientEmail : null;

        LocalDateTime publishedAt = LocalDateTime.now();
        AnnouncementDto draft = new AnnouncementDto(
                null,
                request.title(),
                request.content(),
                audience,
                request.createdByUserId(),
                request.departmentId(),
                recipientEmail,
                "PENDING",
                publishedAt,
                request.attachmentUrl(),
                request.attachmentType(),
                request.fileName()
        );

        String emailDeliveryStatus = announcementEmailService.sendAnnouncementToRecipient(draft);
        KeyHolder keyHolder = new GeneratedKeyHolder();

        jdbcTemplate.update(connection -> {
            PreparedStatement statement = connection.prepareStatement(
                    """
                            INSERT INTO app_announcements (
                                title, content, audience, created_by_user_id, department_id, recipient_email,
                                email_delivery_status, published_at, attachment_url, attachment_type, file_name
                            )
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                            """,
                    Statement.RETURN_GENERATED_KEYS
            );
            statement.setString(1, request.title());
            statement.setString(2, request.content());
            statement.setString(3, audience);
            statement.setLong(4, request.createdByUserId());
            if (request.departmentId() == null) {
                statement.setNull(5, java.sql.Types.BIGINT);
            } else {
                statement.setLong(5, request.departmentId());
            }
            statement.setString(6, recipientEmail);
            statement.setString(7, emailDeliveryStatus);
            statement.setTimestamp(8, java.sql.Timestamp.valueOf(publishedAt));
            statement.setString(9, request.attachmentUrl());
            statement.setString(10, request.attachmentType());
            statement.setString(11, request.fileName());
            return statement;
        }, keyHolder);

        Number id = keyHolder.getKey();
        if (id == null) {
            throw new IllegalStateException("Could not store announcement");
        }

        return new AnnouncementDto(
                id.longValue(),
                request.title(),
                request.content(),
                audience,
                request.createdByUserId(),
                request.departmentId(),
                recipientEmail,
                emailDeliveryStatus,
                publishedAt,
                request.attachmentUrl(),
                request.attachmentType(),
                request.fileName()
        );
    }

    private boolean canAccessAnnouncement(AnnouncementDto announcement, AppUser currentUser) {
        if (currentUser.roles().contains(RoleType.SUPER_ADMIN) || currentUser.roles().contains(RoleType.COLLEGE_ADMIN)) {
            return true;
        }
        if (announcement.createdByUserId() != null && announcement.createdByUserId().equals(currentUser.id())) {
            return true;
        }

        String recipientEmail = normalizeEmail(announcement.recipientEmail());
        if (recipientEmail == null) {
            return true;
        }
        return recipientEmail.equalsIgnoreCase(currentUser.email());
    }

    private String normalizeEmail(String email) {
        if (email == null) {
            return null;
        }
        String normalized = email.trim().toLowerCase();
        return normalized.isBlank() ? null : normalized;
    }

    private void ensureTable() {
        jdbcTemplate.execute(
                """
                        CREATE TABLE IF NOT EXISTS app_announcements (
                            id BIGINT PRIMARY KEY AUTO_INCREMENT,
                            title VARCHAR(255) NOT NULL,
                            content TEXT NOT NULL,
                            audience VARCHAR(80) NOT NULL,
                            created_by_user_id BIGINT NOT NULL,
                            department_id BIGINT NULL,
                            recipient_email VARCHAR(255) NULL,
                            email_delivery_status VARCHAR(80) NOT NULL,
                            published_at DATETIME NOT NULL,
                            attachment_url TEXT NULL,
                            attachment_type VARCHAR(120) NULL,
                            file_name VARCHAR(255) NULL
                        )
                        """
        );
    }
}
