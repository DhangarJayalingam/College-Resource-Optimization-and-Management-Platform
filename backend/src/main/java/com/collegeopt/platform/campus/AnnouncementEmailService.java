package com.collegeopt.platform.campus;

import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

@Service
public class AnnouncementEmailService {

    private final ObjectProvider<JavaMailSender> mailSenderProvider;
    private final String mailFrom;
    private final String backendBaseUrl;

    public AnnouncementEmailService(
            ObjectProvider<JavaMailSender> mailSenderProvider,
            @Value("${app.mail.from:no-reply@collegeopt.local}") String mailFrom,
            @Value("${app.backend-base-url:http://localhost:8080}") String backendBaseUrl) {
        this.mailSenderProvider = mailSenderProvider;
        this.mailFrom = mailFrom;
        this.backendBaseUrl = backendBaseUrl;
    }

    public String sendAnnouncementToRecipient(AnnouncementDto announcement) {
        if (announcement.recipientEmail() == null || announcement.recipientEmail().isBlank()) {
            return "NOT_REQUESTED";
        }

        JavaMailSender mailSender = mailSenderProvider.getIfAvailable();
        if (mailSender == null) {
            return "MAIL_NOT_CONFIGURED";
        }

        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setFrom(mailFrom);
            message.setTo(announcement.recipientEmail());
            message.setSubject("CollegeOpt AI Announcement: " + announcement.title());
            message.setText(buildBody(announcement));
            mailSender.send(message);
            return "SENT";
        } catch (Exception exception) {
            return "FAILED";
        }
    }

    private String buildBody(AnnouncementDto announcement) {
        StringBuilder body = new StringBuilder();
        body.append("You have received a targeted announcement from CollegeOpt AI.")
                .append(System.lineSeparator())
                .append(System.lineSeparator())
                .append("Title: ").append(announcement.title()).append(System.lineSeparator())
                .append("Audience: ").append(announcement.audience()).append(System.lineSeparator())
                .append(System.lineSeparator())
                .append(announcement.content()).append(System.lineSeparator());

        if (announcement.attachmentUrl() != null && !announcement.attachmentUrl().isBlank()) {
            body.append(System.lineSeparator())
                    .append(System.lineSeparator())
                    .append("Attachment: ")
                    .append(toAbsoluteUrl(announcement.attachmentUrl()));
        }

        return body.toString();
    }

    private String toAbsoluteUrl(String url) {
        if (url.startsWith("http://") || url.startsWith("https://")) {
            return url;
        }
        return backendBaseUrl + url;
    }
}
