package com.collegeopt.platform.booking;

import com.collegeopt.platform.campus.ResourceStatusEventDto;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

@Service
public class ResourceStatusPublisher {

    private final SimpMessagingTemplate messagingTemplate;

    public ResourceStatusPublisher(SimpMessagingTemplate messagingTemplate) {
        this.messagingTemplate = messagingTemplate;
    }

    public void publish(ResourceStatusEventDto event) {
        messagingTemplate.convertAndSend("/topic/resource-status", event);
    }
}
