package com.collegeopt.platform.ai;

import com.collegeopt.platform.resource.ClassroomDto;
import com.collegeopt.platform.resource.LaboratoryDto;
import com.collegeopt.platform.resource.ResourceSearchRequest;
import com.collegeopt.platform.resource.ResourceService;
import com.collegeopt.platform.timetable.TimetableConflictDto;
import com.collegeopt.platform.timetable.TimetableService;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class AiOptimizationService {

    private static final Pattern CAPACITY_PATTERN = Pattern.compile("(\\d{1,3})");

    private final ResourceService resourceService;
    private final TimetableService timetableService;

    public AiOptimizationService(ResourceService resourceService, TimetableService timetableService) {
        this.resourceService = resourceService;
        this.timetableService = timetableService;
    }

    public AiResourceRecommendationResponse recommendResource(AiResourceRecommendationRequest request) {
        if ("LABORATORY".equalsIgnoreCase(request.resourceType()) || "LAB".equalsIgnoreCase(request.resourceType())) {
            LaboratoryDto lab = resourceService.recommendLaboratory(request.expectedUsers(), request.requiredTags())
                    .orElseThrow(() -> new IllegalArgumentException("No matching laboratory found"));

            Map<String, Object> payload = new LinkedHashMap<>();
            payload.put("id", lab.id());
            payload.put("labCode", lab.labCode());
            payload.put("capacity", lab.capacity());
            payload.put("tags", lab.tags());
            return new AiResourceRecommendationResponse(
                    "LABORATORY",
                    payload,
                    score(lab.capacity(), request.expectedUsers(), lab.tags(), request.requiredTags()),
                    "Chosen for best capacity fit and feature match with current availability."
            );
        }

        ClassroomDto classroom = resourceService.recommendClassroom(request.expectedUsers(), request.requiredTags())
                .orElseThrow(() -> new IllegalArgumentException("No matching classroom found"));

        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("id", classroom.id());
        payload.put("roomCode", classroom.roomCode());
        payload.put("capacity", classroom.capacity());
        payload.put("tags", classroom.tags());
        return new AiResourceRecommendationResponse(
                "CLASSROOM",
                payload,
                score(classroom.capacity(), request.expectedUsers(), classroom.tags(), request.requiredTags()),
                "Chosen for optimal capacity utilization, requested features, and free status."
        );
    }

    public List<TimetableConflictDto> detectConflicts() {
        return timetableService.detectConflicts();
    }

    public AiDemandPredictionResponse predictDemand(AiDemandPredictionRequest request) {
        double averageUtilization = request.recentUtilizationPercentages().stream()
                .mapToInt(value -> value)
                .average()
                .orElse(0.0);
        double trendBoost = 0.0;
        if (request.recentUtilizationPercentages().size() > 1) {
            List<Integer> values = request.recentUtilizationPercentages();
            trendBoost = Math.max(0, values.get(values.size() - 1) - values.get(0)) * 0.35;
        }
        double predicted = Math.min(100.0, averageUtilization + trendBoost);

        int additionalUnits = predicted >= 85
                ? Math.max(1, (int) Math.ceil(request.currentInventory() * 0.15))
                : predicted >= 70 ? 1 : 0;

        String insight = additionalUnits > 0
                ? "Predicted demand is high. Increase inventory to avoid shortage during peak slots."
                : "Current inventory is likely sufficient for next cycle.";

        return new AiDemandPredictionResponse(request.resourceType(), predicted, additionalUnits, insight);
    }

    public Map<String, Object> naturalLanguageSearch(String query) {
        int capacity = extractCapacity(query).orElse(30);
        Set<String> tags = inferTags(query);
        ResourceSearchRequest request = new ResourceSearchRequest(
                capacity,
                tags,
                LocalDate.now(),
                LocalTime.now().withSecond(0).withNano(0),
                LocalTime.now().plusHours(1).withSecond(0).withNano(0)
        );
        List<ClassroomDto> matches = resourceService.searchClassrooms(request);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("normalizedQuery", query.toLowerCase());
        result.put("capacityDetected", capacity);
        result.put("requiredTagsDetected", tags);
        result.put("matches", matches);
        result.put("matchCount", matches.size());
        return result;
    }

    private double score(int capacity, int expectedUsers, Set<String> availableTags, Set<String> requiredTags) {
        double capacityFit = 1 - ((double) (capacity - expectedUsers) / Math.max(capacity, 1));
        double tagMatch = requiredTags.isEmpty()
                ? 1.0
                : (double) requiredTags.stream().filter(availableTags::contains).count() / requiredTags.size();
        return Math.round((capacityFit * 0.55 + tagMatch * 0.45) * 100.0) / 100.0;
    }

    private java.util.Optional<Integer> extractCapacity(String query) {
        Matcher matcher = CAPACITY_PATTERN.matcher(query);
        if (matcher.find()) {
            return java.util.Optional.of(Integer.parseInt(matcher.group(1)));
        }
        return java.util.Optional.empty();
    }

    private Set<String> inferTags(String query) {
        String normalized = query.toLowerCase();
        java.util.Set<String> tags = new java.util.LinkedHashSet<>();
        if (normalized.contains("projector")) {
            tags.add("PROJECTOR");
        }
        if (normalized.contains("smart board") || normalized.contains("smartboard")) {
            tags.add("SMART_BOARD");
        }
        if (normalized.contains("ac") || normalized.contains("air condition")) {
            tags.add("AC");
        }
        return tags;
    }
}
