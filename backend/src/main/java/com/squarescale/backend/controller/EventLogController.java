package com.squarescale.backend.controller;

import com.squarescale.backend.entity.EventLog;
import com.squarescale.backend.entity.User;
import com.squarescale.backend.repository.AccountRepository;
import com.squarescale.backend.repository.EventLogRepository;
import com.squarescale.backend.repository.UserRepository;
import com.squarescale.backend.service.AuditLogService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/admin/event-logs")
public class EventLogController {

    private final EventLogRepository eventLogRepo;
    private final UserRepository userRepo;
    private final AccountRepository accountRepo;

    public EventLogController(
            EventLogRepository eventLogRepo,
            UserRepository userRepo,
            AccountRepository accountRepo
    ) {
        this.eventLogRepo = eventLogRepo;
        this.userRepo = userRepo;
        this.accountRepo = accountRepo;
    }

    @GetMapping
    public List<EventLogResponse> listAll() {
        return eventLogRepo.findAllByOrderByCreatedAtDesc().stream()
                .map(this::toResponse)
                .toList();
    }

    private EventLogResponse toResponse(EventLog e) {
        String username = userRepo.findById(e.getUserId())
                .map(User::getUsername)
                .orElse("—");
        String accountName = resolveAccountName(e);
        return new EventLogResponse(
                e.getId(),
                e.getEntityType(),
                accountName,
                e.getAction(),
                username,
                e.getCreatedAt()
        );
    }

    private String resolveAccountName(EventLog e) {
        if (!AuditLogService.ENTITY_ACCOUNT.equals(e.getEntityType()) || e.getEntityId() == null) {
            return "—";
        }
        return accountRepo.findById(e.getEntityId())
                .map(a -> a.getAccountName())
                .orElse("—");
    }
}
