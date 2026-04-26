package com.collegeopt.platform.ai;

import com.collegeopt.platform.common.ApiResponse;
import com.collegeopt.platform.timetable.TimetableEntryDto;
import com.collegeopt.platform.timetable.TimetableGenerateRequest;
import com.collegeopt.platform.timetable.TimetableService;
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
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/ai")
public class AiController {

    private final AiOptimizationService aiOptimizationService;
    private final TimetableService timetableService;
    private final AIService aiService;
    private final UserDirectoryService userDirectoryService;

    public AiController(AiOptimizationService aiOptimizationService,
                        TimetableService timetableService,
                        AIService aiService,
                        UserDirectoryService userDirectoryService) {
        this.aiOptimizationService = aiOptimizationService;
        this.timetableService = timetableService;
        this.aiService = aiService;
        this.userDirectoryService = userDirectoryService;
    }

    @PostMapping("/query")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','COLLEGE_ADMIN','FACULTY','STUDENT')")
    public ResponseEntity<ApiResponse<AiChatResponseDto>> query(@Valid @RequestBody AiAssistantQueryRequest request,
                                                                Authentication authentication) {
        return ResponseEntity.ok(ApiResponse.ok("Role-based AI response generated", aiService.query(currentUser(authentication), request.query())));
    }

    @GetMapping("/insights")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','COLLEGE_ADMIN','FACULTY','STUDENT')")
    public ResponseEntity<ApiResponse<AiPanelResponse<AiInsightDto>>> insights(Authentication authentication) {
        return ResponseEntity.ok(ApiResponse.ok("AI insights loaded", aiService.insights(currentUser(authentication))));
    }

    @GetMapping("/recommendations")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','COLLEGE_ADMIN','FACULTY','STUDENT')")
    public ResponseEntity<ApiResponse<AiPanelResponse<AiRecommendationDto>>> recommendations(Authentication authentication) {
        return ResponseEntity.ok(ApiResponse.ok("AI recommendations loaded", aiService.recommendations(currentUser(authentication))));
    }

    @GetMapping("/predictions")
    @PreAuthorize("hasAnyRole('SUPER_ADMIN','COLLEGE_ADMIN','FACULTY','STUDENT')")
    public ResponseEntity<ApiResponse<AiPanelResponse<AiPredictionDto>>> predictions(Authentication authentication) {
        return ResponseEntity.ok(ApiResponse.ok("AI predictions loaded", aiService.predictions(currentUser(authentication))));
    }

    @PostMapping("/recommend-resource")
    public ResponseEntity<ApiResponse<AiResourceRecommendationResponse>> recommend(@Valid @RequestBody AiResourceRecommendationRequest request) {
        return ResponseEntity.ok(ApiResponse.ok("AI resource recommendation generated", aiOptimizationService.recommendResource(request)));
    }

    @GetMapping("/detect-conflicts")
    public ResponseEntity<ApiResponse<?>> detectConflicts() {
        return ResponseEntity.ok(ApiResponse.ok("AI conflict scan completed", aiOptimizationService.detectConflicts()));
    }

    @PostMapping("/demand-prediction")
    @PreAuthorize("hasAnyRole('COLLEGE_ADMIN','SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<AiDemandPredictionResponse>> predictDemand(@Valid @RequestBody AiDemandPredictionRequest request) {
        return ResponseEntity.ok(ApiResponse.ok("AI demand prediction generated", aiOptimizationService.predictDemand(request)));
    }

    @PostMapping("/nl-search")
    public ResponseEntity<ApiResponse<Map<String, Object>>> naturalLanguageSearch(@Valid @RequestBody NaturalLanguageQueryRequest request) {
        return ResponseEntity.ok(ApiResponse.ok("Natural language resource search completed", aiOptimizationService.naturalLanguageSearch(request.query())));
    }

    @PostMapping("/generate-timetable")
    @PreAuthorize("hasAnyRole('COLLEGE_ADMIN','SUPER_ADMIN')")
    public ResponseEntity<ApiResponse<List<TimetableEntryDto>>> generateTimetable(@Valid @RequestBody TimetableGenerateRequest request) {
        return ResponseEntity.ok(ApiResponse.ok("AI timetable generation completed", timetableService.generateAiTimetable(request)));
    }

    private AppUser currentUser(Authentication authentication) {
        return userDirectoryService.findByEmail(authentication.getName())
                .orElseThrow(() -> new IllegalArgumentException("Session expired. Please log in again."));
    }
}
