package com.squarescale.backend.controller;

import com.squarescale.backend.entity.Notification;
import com.squarescale.backend.service.NotificationService;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/notifications")
public class NotificationController {

    public record NotificationOut(
            Integer id,
            String message,
            boolean read,
            String createdAt,
            Long journalEntryId
    ) {}

    public record UnreadCountOut(long unread) {}

    private final NotificationService notificationService;

    public NotificationController(NotificationService notificationService) {
        this.notificationService = notificationService;
    }

    @GetMapping
    public List<NotificationOut> list(@RequestHeader("X-User-Id") Long userId) {
        return notificationService.listForUser(userId).stream().map(this::toOut).toList();
    }

    @GetMapping("/unread-count")
    public UnreadCountOut unreadCount(@RequestHeader("X-User-Id") Long userId) {
        return new UnreadCountOut(notificationService.unreadCount(userId));
    }

    @PostMapping("/{id}/read")
    public void markRead(@RequestHeader("X-User-Id") Long userId, @PathVariable Integer id) {
        notificationService.markRead(userId, id);
    }

    private NotificationOut toOut(Notification n) {
        boolean read = Boolean.TRUE.equals(n.getReadFlag());
        String at = n.getCreatedAt() != null ? n.getCreatedAt().toString() : "";
        return new NotificationOut(
                n.getId(),
                n.getMessage(),
                read,
                at,
                n.getJournalEntryId()
        );
    }
}
