package com.collegeopt.platform.user;

import com.collegeopt.platform.activity.ActivityLogDto;
import com.collegeopt.platform.activity.ActivityLogService;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

@Service
public class UserSettingsService {

    private static final String DEFAULT_THEME = "Ocean Blue";

    private final JdbcTemplate jdbcTemplate;
    private final UserDirectoryService userDirectoryService;
    private final ActivityLogService activityLogService;
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final String backendBaseUrl;

    public UserSettingsService(
            JdbcTemplate jdbcTemplate,
            UserDirectoryService userDirectoryService,
            ActivityLogService activityLogService,
            @Value("${app.backend-base-url:http://localhost:8080}") String backendBaseUrl) {
        this.jdbcTemplate = jdbcTemplate;
        this.userDirectoryService = userDirectoryService;
        this.activityLogService = activityLogService;
        this.backendBaseUrl = backendBaseUrl;
        ensurePreferencesTable();
    }

    public UserSettingsResponse getSettings(String email) {
        AppUser user = currentUser(email);
        return new UserSettingsResponse(toProfile(user), ensurePreferences(user.id()));
    }

    @Transactional
    public ProfileUpdateResponse updateProfile(String email, String fullName, String newEmail, Long requestedDepartmentId,
                                               String profileImageUrl) {
        AppUser currentUser = currentUser(email);
        Long targetDepartmentId = currentUser.departmentId();
        boolean canChangeDepartment = currentUser.roles().contains(RoleType.SUPER_ADMIN)
                || currentUser.roles().contains(RoleType.COLLEGE_ADMIN);
        if (canChangeDepartment && requestedDepartmentId != null) {
            targetDepartmentId = requestedDepartmentId;
        }

        AppUser updated = userDirectoryService.updateProfile(
                currentUser.id(),
                fullName,
                newEmail,
                targetDepartmentId);

        if (profileImageUrl != null && !profileImageUrl.isBlank()) {
            upsertPreferences(
                    updated.id(),
                    "profile_image_url = ?",
                    List.of(profileImageUrl));
        }

        boolean requiresReauthentication = !updated.email().equalsIgnoreCase(currentUser.email());
        if (requiresReauthentication) {
            userDirectoryService.incrementSessionVersion(updated.id());
        }

        return new ProfileUpdateResponse(toProfile(updated), requiresReauthentication);
    }

    @Transactional
    public UserPreferences updateTheme(String email, UpdateThemeRequest request) {
        AppUser user = currentUser(email);
        UserPreferences current = ensurePreferences(user.id());
        List<Object> values = new java.util.ArrayList<>();
        values.add(safeText(request.theme(), current.theme()));
        values.add(safeText(request.customThemeName(), current.customThemeName()));
        values.add(safeText(request.backgroundGradient(), current.backgroundGradient()));
        values.add(safeText(request.cardColor(), current.cardColor()));
        values.add(safeText(request.accentColor(), current.accentColor()));
        values.add(safeText(request.textColor(), current.textColor()));
        values.add(defaultIfNull(request.animationEnabled(), current.animationEnabled()));
        values.add(defaultIfNull(request.glassEffectEnabled(), current.glassEffectEnabled()));
        values.add(defaultIfNull(request.autoThemeEnabled(), current.autoThemeEnabled()));
        upsertPreferences(
                user.id(),
                """
                        theme = ?,
                        custom_theme_name = ?,
                        background_gradient = ?,
                        card_color = ?,
                        accent_color = ?,
                        text_color = ?,
                        animation_enabled = ?,
                        glass_effect_enabled = ?,
                        auto_theme_enabled = ?
                        """,
                values);
        return ensurePreferences(user.id());
    }

    @Transactional
    public UserPreferences updatePreferences(String email, UpdateUserPreferencesRequest request) {
        AppUser user = currentUser(email);
        UserPreferences current = ensurePreferences(user.id());
        List<Object> values = new java.util.ArrayList<>();
        values.add(defaultIfNull(request.emailNotificationsEnabled(), current.emailNotificationsEnabled()));
        values.add(defaultIfNull(request.announcementAlertsEnabled(), current.announcementAlertsEnabled()));
        values.add(defaultIfNull(request.aiAlertsEnabled(), current.aiAlertsEnabled()));
        values.add(defaultIfNull(request.systemUpdatesEnabled(), current.systemUpdatesEnabled()));
        values.add(defaultIfNull(request.aiEnabled(), current.aiEnabled()));
        values.add(defaultIfNull(request.animationEnabled(), current.animationEnabled()));
        values.add(defaultIfNull(request.glassEffectEnabled(), current.glassEffectEnabled()));
        values.add(defaultIfNull(request.autoThemeEnabled(), current.autoThemeEnabled()));
        values.add(safeText(request.predictionLevel(), current.predictionLevel()));
        values.add(safeText(request.customThemeName(), current.customThemeName()));
        values.add(safeText(request.backgroundGradient(), current.backgroundGradient()));
        values.add(safeText(request.cardColor(), current.cardColor()));
        values.add(safeText(request.accentColor(), current.accentColor()));
        values.add(safeText(request.textColor(), current.textColor()));
        values.add(writeJson(request.roleSettings() == null ? current.roleSettings() : request.roleSettings()));
        upsertPreferences(
                user.id(),
                """
                        email_notifications_enabled = ?,
                        announcement_alerts_enabled = ?,
                        ai_alerts_enabled = ?,
                        system_updates_enabled = ?,
                        ai_enabled = ?,
                        animation_enabled = ?,
                        glass_effect_enabled = ?,
                        auto_theme_enabled = ?,
                        prediction_level = ?,
                        custom_theme_name = ?,
                        background_gradient = ?,
                        card_color = ?,
                        accent_color = ?,
                        text_color = ?,
                        role_settings = ?
                        """,
                values);
        return ensurePreferences(user.id());
    }

    public List<ActivityLogDto> listActivityLogs(String email) {
        AppUser user = currentUser(email);
        if (user.roles().contains(RoleType.SUPER_ADMIN) || user.roles().contains(RoleType.COLLEGE_ADMIN)) {
            return activityLogService.listLogs();
        }
        return activityLogService.listLogsForUser(user.id());
    }

    public Map<String, Object> exportUserData(String email) {
        AppUser user = currentUser(email);
        UserSettingsResponse settings = getSettings(email);
        return Map.of(
                "profile", settings.profile(),
                "preferences", settings.preferences(),
                "activityLogs", listActivityLogs(email),
                "exportedAt", java.time.Instant.now().toString(),
                "role", user.roles()
        );
    }

    @Transactional
    public String deleteAccount(String email) {
        AppUser user = currentUser(email);
        if (user.roles().contains(RoleType.SUPER_ADMIN)) {
            throw new IllegalArgumentException("Principal account deletion is disabled for safety.");
        }
        jdbcTemplate.update("DELETE FROM user_preferences WHERE user_id = ?", user.id());
        userDirectoryService.deleteById(user.id());
        return "Account deleted successfully.";
    }

    public String storeProfileImage(String email, org.springframework.web.multipart.MultipartFile file) {
        AppUser user = currentUser(email);
        if (file == null || file.isEmpty()) {
            return ensurePreferences(user.id()).profileImageUrl();
        }

        try {
            Path uploadPath = Paths.get("uploads/profiles");
            if (!Files.exists(uploadPath)) {
                Files.createDirectories(uploadPath);
            }

            String originalName = Objects.requireNonNullElse(file.getOriginalFilename(), "profile");
            String extension = "";
            int dotIndex = originalName.lastIndexOf('.');
            if (dotIndex >= 0) {
                extension = originalName.substring(dotIndex);
            }
            String fileName = "user-" + user.id() + "-" + UUID.randomUUID().toString().replace("-", "") + extension;
            Path filePath = uploadPath.resolve(fileName).normalize();
            Files.copy(file.getInputStream(), filePath, StandardCopyOption.REPLACE_EXISTING);
            return normalizeBaseUrl(backendBaseUrl) + "/api/v1/user/profile-image/" + fileName;
        } catch (IOException ex) {
            throw new IllegalStateException("Could not store profile image", ex);
        }
    }

    public Path resolveProfileImage(String fileName) {
        Path basePath = Paths.get("uploads/profiles").toAbsolutePath().normalize();
        Path resolved = basePath.resolve(fileName).normalize();
        if (!resolved.startsWith(basePath) || !Files.exists(resolved)) {
            throw new IllegalArgumentException("Profile image not found.");
        }
        return resolved;
    }

    private AppUser currentUser(String email) {
        return userDirectoryService.findByEmail(email)
                .orElseThrow(() -> new IllegalArgumentException("User not found"));
    }

    private UserSettingsProfile toProfile(AppUser user) {
        UserPreferences preferences = ensurePreferences(user.id());
        String departmentName = jdbcTemplate.query(
                "SELECT name FROM departments WHERE id = ?",
                rs -> rs.next() ? rs.getString(1) : null,
                user.departmentId());
        return new UserSettingsProfile(
                user.id(),
                user.fullName(),
                user.email(),
                user.departmentId(),
                departmentName,
                user.roles(),
                preferences.profileImageUrl());
    }

    private UserPreferences ensurePreferences(Long userId) {
        List<UserPreferences> rows = jdbcTemplate.query(
                """
                        SELECT user_id, theme, email_notifications_enabled, announcement_alerts_enabled,
                               ai_alerts_enabled, system_updates_enabled, ai_enabled, animation_enabled,
                               glass_effect_enabled, auto_theme_enabled, prediction_level, profile_image_url,
                               custom_theme_name, background_gradient, card_color, accent_color, text_color,
                               role_settings
                        FROM user_preferences
                        WHERE user_id = ?
                        """,
                (rs, rowNum) -> new UserPreferences(
                        rs.getLong("user_id"),
                        rs.getString("theme"),
                        rs.getBoolean("email_notifications_enabled"),
                        rs.getBoolean("announcement_alerts_enabled"),
                        rs.getBoolean("ai_alerts_enabled"),
                        rs.getBoolean("system_updates_enabled"),
                        rs.getBoolean("ai_enabled"),
                        rs.getBoolean("animation_enabled"),
                        rs.getBoolean("glass_effect_enabled"),
                        rs.getBoolean("auto_theme_enabled"),
                        rs.getString("prediction_level"),
                        rs.getString("profile_image_url"),
                        rs.getString("custom_theme_name"),
                        rs.getString("background_gradient"),
                        rs.getString("card_color"),
                        rs.getString("accent_color"),
                        rs.getString("text_color"),
                        readJson(rs.getString("role_settings"))
                ),
                userId);

        if (!rows.isEmpty()) {
            return rows.get(0);
        }

        Map<String, Object> defaultRoleSettings = Map.of(
                "dashboardLayout", "focused",
                "resourcePreference", "balanced",
                "timetableDensity", "comfortable"
        );
        jdbcTemplate.update(
                """
                        INSERT INTO user_preferences (
                            user_id, theme, email_notifications_enabled, announcement_alerts_enabled,
                            ai_alerts_enabled, system_updates_enabled, ai_enabled, animation_enabled,
                            glass_effect_enabled, auto_theme_enabled, prediction_level, profile_image_url,
                            custom_theme_name, background_gradient, card_color, accent_color, text_color,
                            role_settings, updated_at
                        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
                        """,
                userId,
                DEFAULT_THEME,
                true,
                true,
                true,
                true,
                true,
                true,
                true,
                false,
                "ADVANCED",
                null,
                null,
                null,
                null,
                null,
                null,
                writeJson(defaultRoleSettings)
        );
        return ensurePreferences(userId);
    }

    private void upsertPreferences(Long userId, String updateSetClause, List<Object> values) {
        ensurePreferences(userId);
        List<Object> parameters = new java.util.ArrayList<>(values);
        parameters.add(userId);
        jdbcTemplate.update(
                "UPDATE user_preferences SET " + updateSetClause + ", updated_at = CURRENT_TIMESTAMP WHERE user_id = ?",
                parameters.toArray());
    }

    private void ensurePreferencesTable() {
        jdbcTemplate.execute(
                """
                        CREATE TABLE IF NOT EXISTS user_preferences (
                            user_id BIGINT PRIMARY KEY,
                            theme VARCHAR(80) NOT NULL,
                            email_notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE,
                            announcement_alerts_enabled BOOLEAN NOT NULL DEFAULT TRUE,
                            ai_alerts_enabled BOOLEAN NOT NULL DEFAULT TRUE,
                            system_updates_enabled BOOLEAN NOT NULL DEFAULT TRUE,
                            ai_enabled BOOLEAN NOT NULL DEFAULT TRUE,
                            animation_enabled BOOLEAN NOT NULL DEFAULT TRUE,
                            glass_effect_enabled BOOLEAN NOT NULL DEFAULT TRUE,
                            auto_theme_enabled BOOLEAN NOT NULL DEFAULT FALSE,
                            prediction_level VARCHAR(30) NOT NULL DEFAULT 'ADVANCED',
                            profile_image_url VARCHAR(500) NULL,
                            custom_theme_name VARCHAR(120) NULL,
                            background_gradient VARCHAR(500) NULL,
                            card_color VARCHAR(120) NULL,
                            accent_color VARCHAR(120) NULL,
                            text_color VARCHAR(120) NULL,
                            role_settings JSON NULL,
                            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
                        )
                        """
        );
    }

    private String safeText(String candidate, String fallback) {
        return candidate == null || candidate.isBlank() ? fallback : candidate.trim();
    }

    private boolean defaultIfNull(Boolean candidate, boolean fallback) {
        return candidate == null ? fallback : candidate;
    }

    private String writeJson(Map<String, Object> value) {
        try {
            return objectMapper.writeValueAsString(value == null ? Map.of() : value);
        } catch (Exception ex) {
            throw new IllegalStateException("Could not write user settings payload", ex);
        }
    }

    private Map<String, Object> readJson(String raw) {
        if (raw == null || raw.isBlank()) {
            return Map.of();
        }
        try {
            return objectMapper.readValue(raw, new TypeReference<LinkedHashMap<String, Object>>() {
            });
        } catch (Exception ex) {
            return Map.of();
        }
    }

    private String normalizeBaseUrl(String url) {
        return url.endsWith("/") ? url.substring(0, url.length() - 1) : url;
    }
}
