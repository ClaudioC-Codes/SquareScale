package com.squarescale.backend.controller;

import com.squarescale.backend.dto.CreateJournalRequest;
import com.squarescale.backend.dto.JournalDecisionRequest;
import com.squarescale.backend.dto.JournalDetailResponse;
import com.squarescale.backend.dto.JournalSummaryResponse;
import com.squarescale.backend.entity.JournalEntry;
import com.squarescale.backend.service.JournalService;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import tools.jackson.databind.json.JsonMapper;

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/journal")
public class JournalController {

    private static final JsonMapper JSON = JsonMapper.builder().build();

    private final JournalService journalService;

    public JournalController(JournalService journalService) {
        this.journalService = journalService;
    }

    @PostMapping(value = "/entries", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<String> create(
            @RequestPart("entry") String entryJson,
            @RequestPart(value = "files", required = false) List<MultipartFile> files,
            @RequestHeader(value = "X-User-Id", required = false) Long headerUserId
    ) {
        try {
            CreateJournalRequest req = JSON.readValue(entryJson, CreateJournalRequest.class);
            JournalEntry saved = journalService.create(req, files != null ? files : List.of(), headerUserId);
            return ResponseEntity.ok("Journal entry " + saved.getId() + " submitted for approval.");
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body(e.getMessage() != null ? e.getMessage() : "Could not save journal entry.");
        }
    }

    @GetMapping("/entries")
    public List<JournalSummaryResponse> list(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String entryType,
            @RequestParam(required = false) LocalDate dateFrom,
            @RequestParam(required = false) LocalDate dateTo,
            @RequestParam(required = false) String search
    ) {
        return journalService.list(status, entryType, dateFrom, dateTo, search);
    }

    @GetMapping("/entries/{id}")
    public ResponseEntity<JournalDetailResponse> getOne(@PathVariable Long id) {
        return journalService.findDetail(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping("/entries/{id}/attachments/{attachmentId}")
    public ResponseEntity<byte[]> downloadAttachment(
            @PathVariable Long id,
            @PathVariable Long attachmentId
    ) {
        return journalService.getAttachment(id, attachmentId)
                .map(att -> {
                    HttpHeaders headers = new HttpHeaders();
                    String ct = att.getContentType();
                    headers.setContentType(MediaType.parseMediaType(
                            ct != null && !ct.isBlank() ? ct : MediaType.APPLICATION_OCTET_STREAM_VALUE));
                    headers.setContentDisposition(
                            ContentDisposition.attachment()
                                    .filename(att.getFilename(), StandardCharsets.UTF_8)
                                    .build());
                    byte[] data = att.getData() != null ? att.getData() : new byte[0];
                    return new ResponseEntity<>(data, headers, HttpStatus.OK);
                })
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping("/entries/{id}/approve")
    public ResponseEntity<String> approve(
            @PathVariable Long id,
            @RequestBody(required = false) JournalDecisionRequest body,
            @RequestHeader(value = "X-User-Id", required = false) Long headerUserId
    ) {
        Long reviewer = body != null && body.reviewedByUserId() != null ? body.reviewedByUserId() : headerUserId;
        try {
            journalService.approve(id, reviewer);
            return ResponseEntity.ok("Journal entry approved and posted to accounts.");
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        } catch (IllegalStateException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(e.getMessage());
        }
    }

    @PostMapping("/entries/{id}/reject")
    public ResponseEntity<String> reject(
            @PathVariable Long id,
            @RequestBody(required = false) JournalDecisionRequest body,
            @RequestHeader(value = "X-User-Id", required = false) Long headerUserId
    ) {
        Long reviewer = body != null && body.reviewedByUserId() != null ? body.reviewedByUserId() : headerUserId;
        String reason = body != null ? body.reason() : null;
        try {
            journalService.reject(id, reviewer, reason != null ? reason : "");
            return ResponseEntity.ok("Journal entry rejected.");
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        } catch (IllegalStateException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(e.getMessage());
        }
    }
}
