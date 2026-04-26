package com.collegeopt.platform.campus;

import com.collegeopt.platform.common.ApiResponse;
import com.collegeopt.platform.user.AppUser;
import com.collegeopt.platform.user.UserDirectoryService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/announcements")
public class AnnouncementController {

    private final AnnouncementService announcementService;
    private final UserDirectoryService userDirectoryService;

    public AnnouncementController(AnnouncementService announcementService, UserDirectoryService userDirectoryService) {
        this.announcementService = announcementService;
        this.userDirectoryService = userDirectoryService;
    }

    @GetMapping
    public ResponseEntity<ApiResponse<List<AnnouncementDto>>> listAnnouncements(Authentication authentication) {
        AppUser currentUser = userDirectoryService.findByEmail(authentication.getName())
                .orElseThrow(() -> new IllegalArgumentException("Session expired. Please log in again."));
        return ResponseEntity.ok(ApiResponse.ok("Announcements loaded", announcementService.listAnnouncementsForUser(currentUser)));
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('COLLEGE_ADMIN','SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<AnnouncementDto>> createAnnouncement(
            @Valid @RequestBody CreateAnnouncementRequest request) {
        return ResponseEntity
                .ok(ApiResponse.ok("Announcement created", announcementService.createAnnouncement(request)));
    }

    @PostMapping("/upload")
    @PreAuthorize("hasAnyRole('COLLEGE_ADMIN','SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<Map<String, String>>> uploadAnnouncementAttachment(
            @RequestParam("file") MultipartFile file) {
        if (file.isEmpty())
            throw new IllegalArgumentException("File is empty");
        if (file.getSize() > 5 * 1024 * 1024)
            throw new IllegalArgumentException("File size exceeds 5MB limit");

        String contentType = file.getContentType();
        String safeContentType = (contentType == null || contentType.isBlank())
                ? "application/octet-stream"
                : contentType;

        try {
            String fileName = UUID.randomUUID() + "_" + file.getOriginalFilename();
            Path uploadPath = Paths.get("uploads/announcements");
            if (!Files.exists(uploadPath))
                Files.createDirectories(uploadPath);

            Path filePath = uploadPath.resolve(fileName);
            Files.copy(file.getInputStream(), filePath);

            return ResponseEntity.ok(ApiResponse.ok("File uploaded successfully", Map.of(
                    "url", "/api/v1/campus/announcements/attachments/" + fileName,
                    "fileName", file.getOriginalFilename(),
                    "type", safeContentType)));
        } catch (IOException e) {
            throw new RuntimeException("Could not store file: " + e.getMessage());
        }
    }
}
