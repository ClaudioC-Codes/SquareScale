package com.squarescale.backend.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public record JournalDetailResponse(
        Long id,
        LocalDate date,
        String entryType,
        String description,
        BigDecimal totalDebit,
        BigDecimal totalCredit,
        String status,
        Long createdByUserId,
        String createdByUsername,
        String rejectionReason,
        List<JournalLineResponse> lines,
        List<AttachmentSummary> attachments
) {
    public record JournalLineResponse(
            String type,
            String accountNumber,
            String accountName,
            BigDecimal amount,
            String description
    ) {}

    public record AttachmentSummary(Long id, String filename) {}
}
