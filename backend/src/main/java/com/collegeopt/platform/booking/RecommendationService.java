package com.collegeopt.platform.booking;

import com.collegeopt.platform.resource.ResourceDto;
import com.collegeopt.platform.resource.ResourceService;
import com.collegeopt.platform.resource.ResourceStatus;
import com.collegeopt.platform.resource.ResourceType;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.Comparator;
import java.util.List;

@Service
public class RecommendationService {

    private final ResourceService resourceService;

    public RecommendationService(ResourceService resourceService) {
        this.resourceService = resourceService;
    }

    public List<BookingRecommendationDto> recommend(ResourceType resourceType, Long departmentId, Integer expectedCapacity,
            LocalDate date, LocalTime startTime, LocalTime endTime, List<BookingDto> bookings) {
        int capacity = expectedCapacity == null ? 1 : expectedCapacity;
        return resourceService.getAllResources().stream()
                .filter(resource -> resource.type() == resourceType)
                .filter(resource -> departmentId == null || resource.departmentId().equals(departmentId))
                .filter(resource -> resource.capacity() >= capacity)
                .filter(resource -> resource.status() != ResourceStatus.UNDER_MAINTENANCE)
                .sorted(Comparator.comparingInt((ResourceDto resource) -> Math.abs(resource.capacity() - capacity))
                        .thenComparing(ResourceDto::building))
                .map(resource -> toRecommendation(resource, date, startTime, endTime, bookings))
                .limit(5)
                .toList();
    }

    private BookingRecommendationDto toRecommendation(ResourceDto resource, LocalDate date, LocalTime startTime, LocalTime endTime,
            List<BookingDto> bookings) {
        boolean blocked = bookings.stream().anyMatch(booking ->
                booking.resourceId().equals(resource.id())
                        && booking.date().equals(date)
                        && !booking.status().equals(BookingStatus.CANCELLED)
                        && !booking.status().equals(BookingStatus.REJECTED)
                        && !booking.status().equals(BookingStatus.COMPLETED)
                        && booking.startTime().isBefore(endTime)
                        && startTime.isBefore(booking.endTime()));

        if (!blocked) {
            return new BookingRecommendationDto(
                    resource.id(),
                    resource.name(),
                    resource.type().name(),
                    resource.building(),
                    startTime.toString(),
                    endTime.toString(),
                    "Available for the selected slot");
        }

        LocalTime nextStart = endTime.plusHours(1);
        return new BookingRecommendationDto(
                resource.id(),
                resource.name(),
                resource.type().name(),
                resource.building(),
                nextStart.toString(),
                nextStart.plusHours(1).toString(),
                "Current slot is occupied. Suggested nearest alternative slot");
    }
}
