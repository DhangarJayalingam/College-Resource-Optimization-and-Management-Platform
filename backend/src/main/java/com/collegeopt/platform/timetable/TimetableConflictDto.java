package com.collegeopt.platform.timetable;

public record TimetableConflictDto(
        String conflictType,
        Long entryAId,
        Long entryBId,
        String reason
) {
}
