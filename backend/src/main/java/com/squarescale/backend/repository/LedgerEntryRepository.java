package com.squarescale.backend.repository;

import com.squarescale.backend.entity.LedgerEntry;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;

public interface LedgerEntryRepository extends JpaRepository<LedgerEntry, Long> {

    long countByJournalEntry_Id(Long journalId);

    List<LedgerEntry> findByAccount_IdOrderByEntryDateAscIdAsc(Long accountId);

    @Query("SELECT l FROM LedgerEntry l JOIN FETCH l.account a WHERE l.entryDate >= :from AND l.entryDate < :toExcl ORDER BY l.entryDate ASC, l.id ASC")
    List<LedgerEntry> findEntriesBetween(@Param("from") LocalDateTime from, @Param("toExcl") LocalDateTime toExcl);
}
