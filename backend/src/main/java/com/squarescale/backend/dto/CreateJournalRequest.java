package com.squarescale.backend.dto;

import java.math.BigDecimal;
import java.util.List;

public record CreateJournalRequest(
        String date,
        String description,
        String entryType,
        Long createdByUserId,
        List<LineReq> lines
) {
    public record LineReq(String type, Long accountId, BigDecimal amount, String description) {}
}
