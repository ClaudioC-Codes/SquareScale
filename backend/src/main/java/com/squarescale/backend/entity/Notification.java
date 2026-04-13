package com.squarescale.backend.entity;

import jakarta.persistence.*;

import java.time.LocalDateTime;

/** In-app notification for a user (e.g. journal entry pending approval). */
@Entity
@Table(name = "notifications")
public class Notification {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "notification_id")
    private Integer id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(columnDefinition = "longtext")
    private String message;

    @Column(name = "is_read")
    private Boolean readFlag;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    @Column(name = "journal_entry_id")
    private Long journalEntryId;

    public Notification() {}

    public Integer getId() { return id; }
    public void setId(Integer id) { this.id = id; }

    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }

    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }

    public Boolean getReadFlag() { return readFlag; }
    public void setReadFlag(Boolean readFlag) { this.readFlag = readFlag; }

    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }

    public Long getJournalEntryId() { return journalEntryId; }
    public void setJournalEntryId(Long journalEntryId) { this.journalEntryId = journalEntryId; }
}
