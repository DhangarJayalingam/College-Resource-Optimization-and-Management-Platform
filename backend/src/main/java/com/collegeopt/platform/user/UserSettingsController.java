package com.collegeopt.platform.user;

import com.collegeopt.platform.activity.ActivityLogDto;
import com.collegeopt.platform.common.ApiResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import org.springframework.core.io.PathResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.nio.file.Path;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/user")
public class UserSettingsController {

    private final UserSettingsService userSettingsService;

    public UserSettingsController(UserSettingsService userSettingsService) {
        this.userSettingsService = userSettingsService;
    }

    @GetMapping("/settings")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','COLLEGE_ADMIN','FACULTY','STUDENT')")
    public ResponseEntity<ApiResponse<UserSettingsResponse>> settings(Authentication authentication) {
        return ResponseEntity.ok(ApiResponse.ok(
                "Settings loaded",
                userSettingsService.getSettings(authentication.getName())));
    }

    @PutMapping(value = "/update", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','COLLEGE_ADMIN','FACULTY','STUDENT')")
    public ResponseEntity<ApiResponse<ProfileUpdateResponse>> updateProfile(
            Authentication authentication,
            @RequestParam("fullName") @NotBlank String fullName,
            @RequestParam("email") @Email @NotBlank String email,
            @RequestParam(value = "departmentId", required = false) Long departmentId,
            @RequestParam(value = "profileImage", required = false) MultipartFile profileImage) {
        String profileImageUrl = userSettingsService.storeProfileImage(authentication.getName(), profileImage);
        return ResponseEntity.ok(ApiResponse.ok(
                "Profile updated",
                userSettingsService.updateProfile(authentication.getName(), fullName, email, departmentId, profileImageUrl)));
    }

    @PutMapping("/theme")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','COLLEGE_ADMIN','FACULTY','STUDENT')")
    public ResponseEntity<ApiResponse<UserPreferences>> updateTheme(
            Authentication authentication,
            @Valid @RequestBody UpdateThemeRequest request) {
        return ResponseEntity.ok(ApiResponse.ok(
                "Theme updated",
                userSettingsService.updateTheme(authentication.getName(), request)));
    }

    @PutMapping("/preferences")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','COLLEGE_ADMIN','FACULTY','STUDENT')")
    public ResponseEntity<ApiResponse<UserPreferences>> updatePreferences(
            Authentication authentication,
            @RequestBody UpdateUserPreferencesRequest request) {
        return ResponseEntity.ok(ApiResponse.ok(
                "Preferences updated",
                userSettingsService.updatePreferences(authentication.getName(), request)));
    }

    @GetMapping("/activity-logs")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','COLLEGE_ADMIN','FACULTY','STUDENT')")
    public ResponseEntity<ApiResponse<List<ActivityLogDto>>> activityLogs(Authentication authentication) {
        return ResponseEntity.ok(ApiResponse.ok(
                "Activity logs loaded",
                userSettingsService.listActivityLogs(authentication.getName())));
    }

    @GetMapping("/export")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','COLLEGE_ADMIN','FACULTY','STUDENT')")
    public ResponseEntity<ApiResponse<Map<String, Object>>> export(Authentication authentication) {
        return ResponseEntity.ok(ApiResponse.ok(
                "User data exported",
                userSettingsService.exportUserData(authentication.getName())));
    }

    @DeleteMapping("/delete-account")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','COLLEGE_ADMIN','FACULTY','STUDENT')")
    public ResponseEntity<ApiResponse<String>> deleteAccount(Authentication authentication) {
        return ResponseEntity.ok(ApiResponse.ok(
                "Account deleted",
                userSettingsService.deleteAccount(authentication.getName())));
    }

    @GetMapping("/profile-image/{fileName:.+}")
    @PreAuthorize("permitAll()")
    public ResponseEntity<Resource> profileImage(@PathVariable("fileName") String fileName) {
        Path filePath = userSettingsService.resolveProfileImage(fileName);
        Resource resource = new PathResource(filePath);
        return ResponseEntity.ok()
                .header(HttpHeaders.CACHE_CONTROL, "public, max-age=86400")
                .contentType(resolveContentType(filePath))
                .body(resource);
    }

    private MediaType resolveContentType(Path filePath) {
        String fileName = filePath.getFileName().toString().toLowerCase();
        if (fileName.endsWith(".png")) {
            return MediaType.IMAGE_PNG;
        }
        if (fileName.endsWith(".jpg") || fileName.endsWith(".jpeg")) {
            return MediaType.IMAGE_JPEG;
        }
        if (fileName.endsWith(".webp")) {
            return MediaType.parseMediaType("image/webp");
        }
        return MediaType.APPLICATION_OCTET_STREAM;
    }
}
