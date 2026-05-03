package com.squarescale.backend.service;

import com.squarescale.backend.dto.CreateJournalRequest;
import com.squarescale.backend.dto.JournalDetailResponse;
import com.squarescale.backend.dto.JournalSummaryResponse;
import com.squarescale.backend.entity.Account;
import com.squarescale.backend.entity.JournalAttachment;
import com.squarescale.backend.entity.JournalEntry;
import com.squarescale.backend.entity.JournalLine;
import com.squarescale.backend.entity.User;
import com.squarescale.backend.repository.AccountRepository;
import com.squarescale.backend.repository.JournalEntryRepository;
import com.squarescale.backend.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Optional;

@Service
public class JournalService {

    private final JournalEntryRepository journalRepo;
    private final AccountRepository accountRepo;
    private final UserRepository userRepo;

    public JournalService(JournalEntryRepository journalRepo,
                          AccountRepository accountRepo,
                          UserRepository userRepo) {
        this.journalRepo = journalRepo;
        this.accountRepo = accountRepo;
        this.userRepo = userRepo;
    }

    @Transactional
    public JournalEntry create(CreateJournalRequest req, List<MultipartFile> files, Long headerUserId) throws IOException {
        if (req == null || req.lines() == null || req.lines().isEmpty()) {
            throw new IllegalArgumentException("Journal entry must include at least one line.");
        }
        Long creator = headerUserId != null ? headerUserId : req.createdByUserId();
        if (creator == null) {
            throw new IllegalArgumentException("createdByUserId or X-User-Id header is required.");
        }
        if (req.date() == null || req.date().isBlank()) {
            throw new IllegalArgumentException("Entry date is required.");
        }
        LocalDate entryDate = LocalDate.parse(req.date().trim());
        String entryType = req.entryType() != null && !req.entryType().isBlank()
                ? req.entryType().trim().toUpperCase(Locale.ROOT)
                : "REGULAR";

        BigDecimal totalDebit = BigDecimal.ZERO;
        BigDecimal totalCredit = BigDecimal.ZERO;

        JournalEntry entry = new JournalEntry();
        entry.setEntryDate(entryDate);
        entry.setDescription(req.description());
        entry.setEntryType(entryType);
        entry.setCreatedByUserId(creator);
        entry.setStatus("PENDING");
        entry.setCreatedAt(LocalDateTime.now());

        for (CreateJournalRequest.LineReq lr : req.lines()) {
            if (lr == null || lr.accountId() == null || lr.amount() == null) {
                throw new IllegalArgumentException("Each line needs accountId and amount.");
            }
            String lt = lr.type() != null ? lr.type().trim().toUpperCase(Locale.ROOT) : "";
            if (!"DEBIT".equals(lt) && !"CREDIT".equals(lt)) {
                throw new IllegalArgumentException("Line type must be DEBIT or CREDIT.");
            }
            BigDecimal amt = lr.amount().setScale(2, RoundingMode.HALF_UP);
            if (amt.compareTo(BigDecimal.ZERO) <= 0) {
                throw new IllegalArgumentException("Amounts must be greater than zero.");
            }
            Account acc = accountRepo.findById(lr.accountId())
                    .orElseThrow(() -> new IllegalArgumentException("Unknown account id: " + lr.accountId()));
            if (!acc.isActive()) {
                throw new IllegalArgumentException("Account is inactive: " + acc.getAccountNumber());
            }

            if ("DEBIT".equals(lt)) {
                totalDebit = totalDebit.add(amt);
            } else {
                totalCredit = totalCredit.add(amt);
            }

            JournalLine line = new JournalLine();
            line.setJournalEntry(entry);
            line.setLineType(lt);
            line.setAccountId(acc.getId());
            line.setAmount(amt);
            line.setDescription(lr.description());
            entry.getLines().add(line);
        }

        if (totalDebit.compareTo(totalCredit) != 0) {
            throw new IllegalArgumentException("Total debits must equal total credits.");
        }

        entry.setTotalDebit(totalDebit);
        entry.setTotalCredit(totalCredit);

        if (files != null) {
            for (MultipartFile f : files) {
                if (f == null || f.isEmpty()) {
                    continue;
                }
                JournalAttachment att = new JournalAttachment();
                att.setJournalEntry(entry);
                att.setFilename(f.getOriginalFilename() != null ? f.getOriginalFilename() : "attachment");
                att.setContentType(f.getContentType());
                att.setData(f.getBytes());
                entry.getAttachments().add(att);
            }
        }

        return journalRepo.save(entry);
    }

    @Transactional(readOnly = true)
    public List<JournalSummaryResponse> list(String status,
                                            String entryType,
                                            LocalDate dateFrom,
                                            LocalDate dateTo,
                                            String search) {
        List<JournalSummaryResponse> out = new ArrayList<>();
        for (JournalEntry e : journalRepo.findAllByOrderByCreatedAtDesc()) {
            if (status != null && !status.isBlank() && !status.equalsIgnoreCase(e.getStatus())) {
                continue;
            }
            if (entryType != null && !entryType.isBlank()
                    && !entryType.equalsIgnoreCase(e.getEntryType())) {
                continue;
            }
            if (dateFrom != null && e.getEntryDate().isBefore(dateFrom)) {
                continue;
            }
            if (dateTo != null && e.getEntryDate().isAfter(dateTo)) {
                continue;
            }
            if (search != null && !search.isBlank()) {
                String desc = e.getDescription() != null ? e.getDescription().toLowerCase(Locale.ROOT) : "";
                if (!desc.contains(search.trim().toLowerCase(Locale.ROOT))) {
                    continue;
                }
            }
            out.add(toSummary(e));
        }
        return out;
    }

    @Transactional(readOnly = true)
    public Optional<JournalDetailResponse> findDetail(Long id) {
        return journalRepo.findById(id).map(this::toDetail);
    }

    @Transactional(readOnly = true)
    public Optional<JournalAttachment> getAttachment(Long journalId, Long attachmentId) {
        return journalRepo.findById(journalId).flatMap(j ->
                j.getAttachments().stream()
                        .filter(a -> a.getId().equals(attachmentId))
                        .findFirst());
    }

    @Transactional
    public void approve(Long id, Long reviewerUserId) {
        JournalEntry entry = journalRepo.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Journal entry not found."));
        if (!"PENDING".equals(entry.getStatus())) {
            throw new IllegalStateException("Only pending entries can be approved.");
        }
        for (JournalLine jl : entry.getLines()) {
            Account a = accountRepo.findById(jl.getAccountId())
                    .orElseThrow(() -> new IllegalStateException("Missing account for line."));
            applyPosting(a, jl.getLineType(), jl.getAmount());
            accountRepo.save(a);
        }
        entry.setStatus("APPROVED");
        entry.setReviewedByUserId(reviewerUserId);
        entry.setReviewedAt(LocalDateTime.now());
        entry.setRejectionReason(null);
        journalRepo.save(entry);
    }

    @Transactional
    public void reject(Long id, Long reviewerUserId, String reason) {
        if (reason == null || reason.isBlank()) {
            throw new IllegalArgumentException("Rejection reason is required.");
        }
        JournalEntry entry = journalRepo.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Journal entry not found."));
        if (!"PENDING".equals(entry.getStatus())) {
            throw new IllegalStateException("Only pending entries can be rejected.");
        }
        entry.setStatus("REJECTED");
        entry.setReviewedByUserId(reviewerUserId);
        entry.setReviewedAt(LocalDateTime.now());
        entry.setRejectionReason(reason.trim());
        journalRepo.save(entry);
    }

    private void applyPosting(Account a, String lineType, BigDecimal amount) {
        BigDecimal amt = amount.setScale(2, RoundingMode.HALF_UP);
        if ("DEBIT".equalsIgnoreCase(lineType)) {
            a.setDebit(a.getDebit().add(amt));
        } else if ("CREDIT".equalsIgnoreCase(lineType)) {
            a.setCredit(a.getCredit().add(amt));
        } else {
            throw new IllegalStateException("Invalid line type: " + lineType);
        }
        BigDecimal bal = a.getInitialBalance().add(a.getDebit()).subtract(a.getCredit());
        a.setBalance(bal.setScale(2, RoundingMode.HALF_UP));
    }

    private JournalSummaryResponse toSummary(JournalEntry e) {
        String uname = userRepo.findById(e.getCreatedByUserId()).map(User::getUsername).orElse(null);
        return new JournalSummaryResponse(
                e.getId(),
                e.getEntryDate(),
                e.getEntryType(),
                e.getDescription(),
                e.getTotalDebit(),
                e.getTotalCredit(),
                e.getStatus(),
                e.getCreatedByUserId(),
                uname
        );
    }

    private JournalDetailResponse toDetail(JournalEntry e) {
        String uname = userRepo.findById(e.getCreatedByUserId()).map(User::getUsername).orElse(null);
        List<JournalDetailResponse.JournalLineResponse> lines = new ArrayList<>();
        for (JournalLine jl : e.getLines()) {
            Account a = accountRepo.findById(jl.getAccountId()).orElse(null);
            String num = a != null ? a.getAccountNumber() : "";
            String name = a != null ? a.getAccountName() : "";
            lines.add(new JournalDetailResponse.JournalLineResponse(
                    jl.getLineType(),
                    num,
                    name,
                    jl.getAmount(),
                    jl.getDescription()
            ));
        }
        List<JournalDetailResponse.AttachmentSummary> atts = e.getAttachments().stream()
                .map(x -> new JournalDetailResponse.AttachmentSummary(x.getId(), x.getFilename()))
                .toList();

        return new JournalDetailResponse(
                e.getId(),
                e.getEntryDate(),
                e.getEntryType(),
                e.getDescription(),
                e.getTotalDebit(),
                e.getTotalCredit(),
                e.getStatus(),
                e.getCreatedByUserId(),
                uname,
                e.getRejectionReason(),
                lines,
                atts
        );
    }
}
