package com.collegeopt.platform.ai;

import com.collegeopt.platform.campus.AnnouncementService;
import com.collegeopt.platform.timetable.TimetableEntryDto;
import com.collegeopt.platform.timetable.TimetableService;
import com.collegeopt.platform.user.AppUser;
import com.collegeopt.platform.user.RoleType;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Optional;

@Service
public class ChatService {

    private final InsightService insightService;
    private final RecommendationService recommendationService;
    private final PredictionService predictionService;
    private final AnnouncementService announcementService;
    private final TimetableService timetableService;

    public ChatService(InsightService insightService,
                       RecommendationService recommendationService,
                       PredictionService predictionService,
                       AnnouncementService announcementService,
                       TimetableService timetableService) {
        this.insightService = insightService;
        this.recommendationService = recommendationService;
        this.predictionService = predictionService;
        this.announcementService = announcementService;
        this.timetableService = timetableService;
    }

    public AiChatResponseDto respond(AppUser currentUser, String query) {
        String normalized = query.trim().toLowerCase(Locale.ENGLISH);
        List<String> sourceModules = new ArrayList<>();
        String answer;

        if (normalized.contains("next class")) {
            sourceModules.add("timetable");
            answer = nextClassAnswer(currentUser);
        } else if (normalized.contains("announcement")) {
            sourceModules.add("announcements");
            long count = announcementService.listAnnouncementsForUser(currentUser).stream()
                    .filter(announcement -> announcement.publishedAt().toLocalDate().equals(LocalDate.now()))
                    .count();
            answer = count == 0
                    ? "There are no new announcements today in your visible scope."
                    : "There are " + count + " new announcements today. Open the announcements page for full details.";
        } else if (normalized.contains("room") || normalized.contains("lab") || normalized.contains("resource")) {
            sourceModules.add("resources");
            AiRecommendationDto recommendation = recommendationService.recommendationsFor(currentUser).get(0);
            answer = recommendation.summary() + " Recommended action: " + recommendation.action();
        } else if (normalized.contains("conflict") || normalized.contains("double book")) {
            sourceModules.add("timetable");
            AiPredictionDto prediction = predictionService.predictionsFor(currentUser).get(0);
            answer = prediction.title() + ": " + prediction.summary() + " Current forecast: " + prediction.predictedValue() + ".";
        } else {
            sourceModules.add("analytics");
            sourceModules.add("recommendations");
            sourceModules.add("predictions");
            AiInsightDto insight = insightService.insightsFor(currentUser).get(0);
            AiRecommendationDto recommendation = recommendationService.recommendationsFor(currentUser).get(0);
            AiPredictionDto prediction = predictionService.predictionsFor(currentUser).get(0);
            answer = insight.title() + ": " + insight.summary()
                    + " Recommended next step: " + recommendation.action()
                    + " Forecast: " + prediction.predictedValue() + ".";
        }

        return new AiChatResponseDto(
                assistantRole(currentUser),
                scopeLabel(currentUser),
                answer,
                samplePrompts(currentUser),
                sourceModules
        );
    }

    private String nextClassAnswer(AppUser currentUser) {
        List<TimetableEntryDto> entries = timetableService.listEntriesByDepartment(currentUser.departmentId());
        Optional<TimetableEntryDto> next = entries.stream()
                .filter(entry -> !entry.startTime().isBefore(LocalTime.now()) || !entry.dayOfWeek().equalsIgnoreCase(LocalDate.now().getDayOfWeek().name()))
                .sorted((first, second) -> {
                    int firstDay = daysUntil(first.dayOfWeek());
                    int secondDay = daysUntil(second.dayOfWeek());
                    if (firstDay != secondDay) {
                        return Integer.compare(firstDay, secondDay);
                    }
                    return first.startTime().compareTo(second.startTime());
                })
                .findFirst();

        return next
                .map(entry -> "Your next visible class is " + entry.courseCode() + " at " + entry.startTime().toString().substring(0, 5)
                        + " in " + entry.resourceName() + ".")
                .orElse("I could not find an upcoming class from the current timetable data.");
    }

    private int daysUntil(String dayOfWeekText) {
        int current = LocalDate.now().getDayOfWeek().getValue();
        int target = java.time.DayOfWeek.valueOf(dayOfWeekText.toUpperCase(Locale.ENGLISH)).getValue();
        return (target - current + 7) % 7;
    }

    private String assistantRole(AppUser currentUser) {
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

    private String scopeLabel(AppUser currentUser) {
        return switch (assistantRole(currentUser)) {
            case "SUPER_ADMIN" -> "Campus-wide control";
            case "COLLEGE_ADMIN" -> "Department operations";
            case "FACULTY" -> "Teaching workspace";
            default -> "Student help desk";
        };
    }

    private List<String> samplePrompts(AppUser currentUser) {
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
