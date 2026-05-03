package com.squarescale.backend.repository;

import com.squarescale.backend.entity.JournalEntry;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface JournalEntryRepository extends JpaRepository<JournalEntry, Long> {

    List<JournalEntry> findAllByOrderByCreatedAtDesc();
}
