package com.squarescale.backend.controller;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/** REST payloads for /journal (matches frontend journal-entry.js and journal-list.js). */
public final class JournalDtos {

    private JournalDtos() {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record CreateJournalRequest(
            LocalDate date,
            String description,
            String entryType,
            Long createdByUserId,
            List<LineIn> lines
    ) {
        @JsonIgnoreProperties(ignoreUnknown = true)
        public record LineIn(String type, Long accountId, BigDecimal amount, String description) {}
    }

    public record JournalDecisionRequest(String action, String reason, Long reviewedByUserId) {}

    public record JournalLineOut(
            String type,
            String accountNumber,
            String accountName,
            BigDecimal amount,
            String description
    ) {}

    public record JournalAttachmentOut(Long id, String filename) {}

    public record JournalEntryListItem(
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

    public record JournalEntryDetail(
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
            List<JournalLineOut> lines,
            List<JournalAttachmentOut> attachments
    ) {}
}
