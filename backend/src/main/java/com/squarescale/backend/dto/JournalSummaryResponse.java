package com.squarescale.backend.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

public record JournalSummaryResponse(
        Long id,
        LocalDate date,
        String entryType,
        String description,
        BigDecimal totalDebit,
        BigDecimal totalCredit,
        String status,
        Long createdByUserId,
        String createdByUsername
) {}
