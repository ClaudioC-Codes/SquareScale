package com.squarescale.backend.service;

import com.squarescale.backend.entity.LedgerEntry;
import com.squarescale.backend.repository.LedgerEntryRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Locale;

/**
 * Read-side ledger lines for an account (posted journal activity).
 */
@Service
public class LedgerService {

    public record LedgerViewLine(
            java.time.LocalDateTime date,
            String description,
            Long journalEntryId,
            BigDecimal debit,
            BigDecimal credit,
            BigDecimal balance
    ) {}

    private final LedgerEntryRepository ledgerEntryRepository;

    public LedgerService(LedgerEntryRepository ledgerEntryRepository) {
        this.ledgerEntryRepository = ledgerEntryRepository;
    }

    @Transactional(readOnly = true)
    public List<LedgerViewLine> getLinesForAccount(Long accountId, LocalDate dateFrom, LocalDate dateTo, String search) {
        List<LedgerEntry> rows = ledgerEntryRepository.findByAccount_IdOrderByEntryDateAscIdAsc(accountId);
        String term = search != null ? search.trim().toLowerCase(Locale.ROOT) : "";
        return rows.stream()
                .filter(e -> dateFrom == null || !e.getEntryDate().toLocalDate().isBefore(dateFrom))
                .filter(e -> dateTo == null || !e.getEntryDate().toLocalDate().isAfter(dateTo))
                .filter(e -> term.isEmpty() || matchesSearch(e, term))
                .map(e -> new LedgerViewLine(
                        e.getEntryDate(),
                        e.getDescription() != null ? e.getDescription() : "",
                        e.getJournalEntry().getId(),
                        e.getDebitAmount(),
                        e.getCreditAmount(),
                        e.getBalanceAfter()
                ))
                .toList();
    }

    private boolean matchesSearch(LedgerEntry e, String termLower) {
        if (e.getDescription() != null && e.getDescription().toLowerCase(Locale.ROOT).contains(termLower)) {
            return true;
        }
        if (e.getPostReference() != null && e.getPostReference().toLowerCase(Locale.ROOT).contains(termLower)) {
            return true;
        }
               String jeId = String.valueOf(e.getJournalEntry().getId());
        if (termLower.contains(jeId)) {
            return true;
        }
        String digitsOnly = termLower.replaceAll("[^0-9]", "");
        if (!digitsOnly.isEmpty() && (jeId.equals(digitsOnly) || jeId.contains(digitsOnly))) {
            return true;
        }
        String d = e.getDebitAmount().toPlainString();
        String c = e.getCreditAmount().toPlainString();
        String b = e.getBalanceAfter().toPlainString();
        String raw = termLower.replace(",", "");
        return d.contains(raw) || c.contains(raw) || b.contains(raw);
    }
}
