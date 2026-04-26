package com.collegeopt.platform.resource;

import java.util.Set;

public record ClassroomDto(
        Long id,
        String roomCode,
        int capacity,
        Set<String> tags,
        ResourceStatus status
) {
}
