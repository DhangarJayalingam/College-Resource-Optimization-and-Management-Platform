package com.collegeopt.platform.campus;

public record CampusDto(
        Long id,
        String campusCode,
        String name,
        String city,
        String status
) {
}
