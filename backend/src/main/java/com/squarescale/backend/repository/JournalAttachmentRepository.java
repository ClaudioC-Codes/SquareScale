package com.squarescale.backend.repository;

import com.squarescale.backend.entity.JournalAttachment;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface JournalAttachmentRepository extends JpaRepository<JournalAttachment, Long> {

    @Query("SELECT a FROM JournalAttachment a WHERE a.id = :aid AND a.journalEntry.id = :jid")
    Optional<JournalAttachment> findByIdAndJournalId(@Param("aid") Long attachmentId, @Param("jid") Long journalId);
}
