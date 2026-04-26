package com.collegeopt.platform.ai;

import com.collegeopt.platform.user.AppUser;
import com.collegeopt.platform.user.RoleType;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class AIService {

    private final InsightService insightService;
    private final RecommendationService recommendationService;
    private final PredictionService predictionService;
    private final ChatService chatService;

    public AIService(InsightService insightService,
                     RecommendationService recommendationService,
                     PredictionService predictionService,
                     ChatService chatService) {
        this.insightService = insightService;
        this.recommendationService = recommendationService;
        this.predictionService = predictionService;
        this.chatService = chatService;
    }

    public AiPanelResponse<AiInsightDto> insights(AppUser currentUser) {
        return new AiPanelResponse<>(
                assistantRole(currentUser),
                scopeLabel(currentUser),
                insightService.insightsFor(currentUser),
                samplePrompts(currentUser)
        );
    }

    public AiPanelResponse<AiRecommendationDto> recommendations(AppUser currentUser) {
        return new AiPanelResponse<>(
                assistantRole(currentUser),
                scopeLabel(currentUser),
                recommendationService.recommendationsFor(currentUser),
                samplePrompts(currentUser)
        );
    }

    public AiPanelResponse<AiPredictionDto> predictions(AppUser currentUser) {
        return new AiPanelResponse<>(
                assistantRole(currentUser),
                scopeLabel(currentUser),
                predictionService.predictionsFor(currentUser),
                samplePrompts(currentUser)
        );
    }

    public AiChatResponseDto query(AppUser currentUser, String query) {
        return chatService.respond(currentUser, query);
    }

    public String assistantRole(AppUser currentUser) {
        if (currentUser.roles().contains(RoleType.SUPER_ADMIN)) {
            return "SUPER_ADMIN";
        }
        if (currentUser.roles().contains(RoleType.COLLEGE_ADMIN)) {
            return "COLLEGE_ADMIN";
        }
        if (currentUser.roles().contains(RoleType.FACULTY)) {
            return "FACULTY";
        }
        return "STUDENT";
    }

    public String scopeLabel(AppUser currentUser) {
        return switch (assistantRole(currentUser)) {
            case "SUPER_ADMIN" -> "Campus-wide control";
            case "COLLEGE_ADMIN" -> "Department operations";
            case "FACULTY" -> "Teaching workspace";
            default -> "Student help desk";
        };
    }

    public List<String> samplePrompts(AppUser currentUser) {
        return switch (assistantRole(currentUser)) {
            case "SUPER_ADMIN" -> List.of(
                    "Which department is using the most labs?",
                    "Show underutilized buildings",
                    "Predict next week's lab demand"
            );
            case "COLLEGE_ADMIN" -> List.of(
                    "Which faculty members are overloaded?",
                    "Show idle labs in my department",
                    "Do we have timetable conflict risk next week?"
            );
            case "FACULTY" -> List.of(
                    "Find me a free room for 2 PM",
                    "Do I have any booking or timetable conflicts?",
                    "What is my next class?"
            );
            default -> List.of(
                    "What is my next class?",
                    "Find a free room for study",
                    "Summarize today's announcements"
            );
        };
    }
}
