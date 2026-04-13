package com.squarescale.backend.service;

import com.squarescale.backend.entity.Notification;
import com.squarescale.backend.entity.User;
import com.squarescale.backend.repository.NotificationRepository;
import com.squarescale.backend.repository.UserRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class NotificationService {

    private static final List<Integer> MANAGER_AND_ADMIN_ROLES = List.of(2, 3);

    private final NotificationRepository notificationRepository;
    private final UserRepository userRepository;

    public NotificationService(NotificationRepository notificationRepository, UserRepository userRepository) {
        this.notificationRepository = notificationRepository;
        this.userRepository = userRepository;
    }

    @Transactional
    public void notifyJournalPendingApproval(Long journalEntryId, Long createdByUserId) {
        if (journalEntryId == null) {
            return;
        }
        String creatorLabel = "A user";
        if (createdByUserId != null) {
            creatorLabel = userRepository.findById(createdByUserId)
                    .map(User::getUsername)
                    .orElse("User #" + createdByUserId);
        }
        String msg = creatorLabel + " submitted journal entry JE-" + journalEntryId + " for approval.";
        LocalDateTime now = LocalDateTime.now();
        List<User> recipients = userRepository.findByRoleIdInAndActiveTrue(MANAGER_AND_ADMIN_ROLES);
        for (User r : recipients) {
            Notification n = new Notification();
            n.setUserId(r.getId());
            n.setMessage(msg);
            n.setReadFlag(false);
            n.setCreatedAt(now);
            n.setJournalEntryId(journalEntryId);
            notificationRepository.save(n);
        }
    }

    @Transactional(readOnly = true)
    public List<Notification> listForUser(Long userId) {
        requireUser(userId);
        return notificationRepository.findByUserIdOrderByCreatedAtDesc(userId);
    }

    @Transactional(readOnly = true)
    public long unreadCount(Long userId) {
        requireUser(userId);
        return notificationRepository.countByUserIdAndReadFlagFalse(userId);
    }

    @Transactional
    public void markRead(Long userId, Integer notificationId) {
        requireUser(userId);
        Notification n = notificationRepository.findById(notificationId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Notification not found."));
        if (!userId.equals(n.getUserId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Not your notification.");
        }
        n.setReadFlag(true);
        notificationRepository.save(n);
    }

    private void requireUser(Long userId) {
        if (userId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "X-User-Id header is required.");
        }
        if (userRepository.findById(userId).isEmpty()) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found.");
        }
    }
}
