package com.squarescale.backend.controller;

import java.time.LocalDateTime;

/**
 * Event log row for API: account display name when the entity is an account, username of actor, no before/after payloads.
 */
public record EventLogResponse(
        Long id,
        String entityType,
        String accountName,
        String action,
        String performedByUsername,
        LocalDateTime createdAt
) {}
