package com.collegeopt.platform.booking;

import com.collegeopt.platform.resource.ResourceType;
import com.collegeopt.platform.timetable.TimetableEntryDto;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;

@Service
public class ConflictDetectionService {

    public void checkResourceConflict(List<BookingDto> bookings, Long bookingId, Long resourceId, LocalDate date,
            LocalTime startTime, LocalTime endTime) {
        boolean conflict = bookings.stream().anyMatch(existing ->
                !existing.status().equals(BookingStatus.CANCELLED)
                        && !existing.status().equals(BookingStatus.REJECTED)
                        && !existing.status().equals(BookingStatus.COMPLETED)
                        && !existing.id().equals(bookingId)
                        && existing.resourceId().equals(resourceId)
                        && existing.date().equals(date)
                        && overlaps(existing.startTime(), existing.endTime(), startTime, endTime));
        if (conflict) {
            throw new IllegalArgumentException("Resource is already booked for the selected time range");
        }
    }

    public void checkFacultyConflict(List<TimetableEntryDto> timetableEntries, String facultyName, LocalDate date,
            LocalTime startTime, LocalTime endTime) {
        if (facultyName == null || facultyName.isBlank()) {
            return;
        }
        boolean conflict = timetableEntries.stream().anyMatch(entry ->
                entry.facultyName().equalsIgnoreCase(facultyName)
                        && entry.dayOfWeek().equalsIgnoreCase(date.getDayOfWeek().name())
                        && overlaps(entry.startTime(), entry.endTime(), startTime, endTime));
        if (conflict) {
            throw new IllegalArgumentException("Faculty conflict detected for the selected time window");
        }
    }

    public void checkEquipmentConflict(List<BookingDto> bookings, Long bookingId, Long resourceId, ResourceType resourceType,
            LocalDate date, LocalTime startTime, LocalTime endTime) {
        if (resourceType != ResourceType.EQUIPMENT) {
            return;
        }
        boolean conflict = bookings.stream().anyMatch(existing ->
                existing.resourceType().equals(ResourceType.EQUIPMENT.name())
                        && !existing.id().equals(bookingId)
                        && !existing.status().equals(BookingStatus.CANCELLED)
                        && !existing.status().equals(BookingStatus.REJECTED)
                        && !existing.status().equals(BookingStatus.COMPLETED)
                        && existing.resourceId().equals(resourceId)
                        && existing.date().equals(date)
                        && overlaps(existing.startTime(), existing.endTime(), startTime, endTime));
        if (conflict) {
            throw new IllegalArgumentException("Equipment conflict detected for the selected time window");
        }
    }

    private boolean overlaps(LocalTime firstStart, LocalTime firstEnd, LocalTime secondStart, LocalTime secondEnd) {
        return firstStart.isBefore(secondEnd) && secondStart.isBefore(firstEnd);
    }
}
