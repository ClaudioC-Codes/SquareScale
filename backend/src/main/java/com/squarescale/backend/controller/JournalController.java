package com.squarescale.backend.controller;

import com.squarescale.backend.controller.JournalDtos.JournalEntryDetail;
import com.squarescale.backend.controller.JournalDtos.JournalEntryListItem;
import com.squarescale.backend.entity.JournalAttachment;
import com.squarescale.backend.service.JournalService;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.util.List;

/**
 * Journal entries: create (multipart), list with filters, detail, approve/reject, attachment download.
 */
@RestController
@RequestMapping("/journal")
public class JournalController {

    private final JournalService journalService;

    public JournalController(JournalService journalService) {
        this.journalService = journalService;
    }

    @GetMapping("/entries")
    public List<JournalEntryListItem> listEntries(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String entryType,
            @RequestParam(required = false) LocalDate dateFrom,
            @RequestParam(required = false) LocalDate dateTo,
            @RequestParam(required = false) String search
    ) {
        return journalService.listEntries(status, entryType, dateFrom, dateTo, search);
    }

    @GetMapping("/entries/{id}")
    public JournalEntryDetail getEntry(@PathVariable Long id) {
        return journalService.getDetail(id);
    }

    @PostMapping(value = "/entries", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<String> createEntry(
            @RequestPart("entry") JournalDtos.CreateJournalRequest entry,
            @RequestPart(value = "files", required = false) List<MultipartFile> files,
            @RequestHeader(value = "X-User-Id", required = false) Long actingUserId
    ) {
        try {
            String msg = journalService.createFromMultipart(entry, files, actingUserId);
            return ResponseEntity.ok(msg);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @PostMapping("/entries/{id}/approve")
    public ResponseEntity<String> approve(
            @PathVariable Long id,
            @RequestHeader(value = "X-User-Id", required = false) Long reviewerUserId,
            @RequestBody(required = false) JournalDtos.JournalDecisionRequest body
    ) {
        Long uid = reviewerUserId != null ? reviewerUserId : (body != null ? body.reviewedByUserId() : null);
        try {
            journalService.approve(id, uid);
            return ResponseEntity.ok("Entry approved.");
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        } catch (ResponseStatusException e) {
            return ResponseEntity.status(e.getStatusCode()).body(e.getReason());
        }
    }

    @PostMapping("/entries/{id}/reject")
    public ResponseEntity<String> reject(
            @PathVariable Long id,
            @RequestHeader(value = "X-User-Id", required = false) Long reviewerUserId,
            @RequestBody(required = false) JournalDtos.JournalDecisionRequest body
    ) {
        Long uid = reviewerUserId != null ? reviewerUserId : (body != null ? body.reviewedByUserId() : null);
        String reason = body != null ? body.reason() : null;
        try {
            journalService.reject(id, uid, reason);
            return ResponseEntity.ok("Entry rejected.");
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        } catch (ResponseStatusException e) {
            return ResponseEntity.status(e.getStatusCode()).body(e.getReason());
        }
    }

    @GetMapping("/entries/{entryId}/attachments/{attachmentId}")
    public ResponseEntity<byte[]> downloadAttachment(
            @PathVariable Long entryId,
            @PathVariable Long attachmentId
    ) {
        JournalAttachment a = journalService.downloadAttachment(entryId, attachmentId);
        MediaType mt = MediaType.APPLICATION_OCTET_STREAM;
        try {
            if (a.getContentType() != null && !a.getContentType().isBlank()) {
                mt = MediaType.parseMediaType(a.getContentType());
            }
        } catch (Exception ignored) {
            /* keep octet-stream */
        }
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + a.getFilename().replace("\"", "") + "\"")
                .contentType(mt)
                .body(a.getData());
    }
}
