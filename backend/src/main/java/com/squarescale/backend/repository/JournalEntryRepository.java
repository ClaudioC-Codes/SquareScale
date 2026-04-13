package com.squarescale.backend.repository;

import com.squarescale.backend.entity.JournalEntry;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface JournalEntryRepository extends JpaRepository<JournalEntry, Long>, JpaSpecificationExecutor<JournalEntry> {

    @EntityGraph(attributePaths = {"lines", "lines.account", "attachments"})
    @Query("SELECT e FROM JournalEntry e WHERE e.id = :id")
    Optional<JournalEntry> findDetailById(@Param("id") Long id);

    @EntityGraph(attributePaths = {"lines", "lines.account"})
    @Query("SELECT e FROM JournalEntry e WHERE e.id IN :ids")
    List<JournalEntry> findAllByIdWithLines(@Param("ids") Collection<Long> ids);
}
