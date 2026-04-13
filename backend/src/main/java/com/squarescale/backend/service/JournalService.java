package com.squarescale.backend.service;

import com.squarescale.backend.controller.JournalDtos;
import com.squarescale.backend.controller.JournalDtos.CreateJournalRequest;
import com.squarescale.backend.controller.JournalDtos.CreateJournalRequest.LineIn;
import com.squarescale.backend.controller.JournalDtos.JournalAttachmentOut;
import com.squarescale.backend.controller.JournalDtos.JournalEntryDetail;
import com.squarescale.backend.controller.JournalDtos.JournalEntryListItem;
import com.squarescale.backend.controller.JournalDtos.JournalLineOut;
import com.squarescale.backend.entity.Account;
import com.squarescale.backend.entity.JournalAttachment;
import com.squarescale.backend.entity.JournalEntry;
import com.squarescale.backend.entity.JournalLine;
import com.squarescale.backend.entity.LedgerEntry;
import com.squarescale.backend.entity.User;
import com.squarescale.backend.repository.AccountRepository;
import com.squarescale.backend.repository.JournalAttachmentRepository;
import com.squarescale.backend.repository.JournalEntryRepository;
import com.squarescale.backend.repository.LedgerEntryRepository;
import com.squarescale.backend.repository.UserRepository;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

import java.io.IOException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class JournalService {

    public static final String STATUS_PENDING = "PENDING";
    public static final String STATUS_APPROVED = "APPROVED";
    public static final String STATUS_REJECTED = "REJECTED";

    private static final Set<String> ENTRY_TYPES = Set.of("REGULAR", "ADJUSTING");
    private static final Set<String> LINE_TYPES = Set.of("DEBIT", "CREDIT");
    private static final Set<String> ALLOWED_EXT = Set.of(
            "pdf", "doc", "docx", "xls", "xlsx", "csv", "jpg", "jpeg", "png"
    );

    private final JournalEntryRepository journalEntryRepository;
    private final JournalAttachmentRepository journalAttachmentRepository;
    private final LedgerEntryRepository ledgerEntryRepository;
    private final AccountRepository accountRepository;
    private final UserRepository userRepository;
    private final NotificationService notificationService;

    public JournalService(
            JournalEntryRepository journalEntryRepository,
            JournalAttachmentRepository journalAttachmentRepository,
            LedgerEntryRepository ledgerEntryRepository,
            AccountRepository accountRepository,
            UserRepository userRepository,
            NotificationService notificationService
    ) {
        this.journalEntryRepository = journalEntryRepository;
        this.journalAttachmentRepository = journalAttachmentRepository;
        this.ledgerEntryRepository = ledgerEntryRepository;
        this.accountRepository = accountRepository;
        this.userRepository = userRepository;
        this.notificationService = notificationService;
    }

    @Transactional(readOnly = true)
    public List<JournalEntryListItem> listEntries(
            String status,
            String entryType,
            LocalDate dateFrom,
            LocalDate dateTo,
            String search
    ) {
        Specification<JournalEntry> spec = buildFilterSpec(status, entryType, dateFrom, dateTo);
        Sort sort = Sort.by(Sort.Order.desc("entryDate"), Sort.Order.desc("id"));
        List<JournalEntry> rows = journalEntryRepository.findAll(spec, sort);
        if (search != null && !search.isBlank()) {
            List<Long> ids = rows.stream().map(JournalEntry::getId).toList();
            if (ids.isEmpty()) {
                return List.of();
            }
            Map<Long, JournalEntry> withLines = journalEntryRepository.findAllByIdWithLines(ids).stream()
                    .collect(Collectors.toMap(JournalEntry::getId, e -> e));
            String term = search.trim();
            rows = rows.stream()
                    .filter(e -> matchesSearch(withLines.get(e.getId()), term))
                    .toList();
        }
        return rows.stream().map(this::toListItem).toList();
    }

    private Specification<JournalEntry> buildFilterSpec(
            String status,
            String entryType,
            LocalDate dateFrom,
            LocalDate dateTo
    ) {
        return (root, query, cb) -> {
            List<Predicate> ps = new ArrayList<>();
            if (status != null && !status.isBlank()) {
                ps.add(cb.equal(root.get("status"), status.trim().toUpperCase(Locale.ROOT)));
            }
            if (entryType != null && !entryType.isBlank()) {
                ps.add(cb.equal(root.get("entryType"), entryType.trim().toUpperCase(Locale.ROOT)));
            }
            if (dateFrom != null) {
                ps.add(cb.greaterThanOrEqualTo(root.get("entryDate"), dateFrom));
            }
            if (dateTo != null) {
                ps.add(cb.lessThanOrEqualTo(root.get("entryDate"), dateTo));
            }
            if (ps.isEmpty()) {
                return cb.conjunction();
            }
            return cb.and(ps.toArray(Predicate[]::new));
        };
    }

    /** Extra pass when search should also match totals (e.g. amount substring). */
    private boolean matchesSearch(JournalEntry full, String raw) {
        if (full == null || raw == null || raw.isBlank()) {
            return false;
        }
        String s = raw.trim().toLowerCase(Locale.ROOT);
        if (full.getDescription() != null && full.getDescription().toLowerCase(Locale.ROOT).contains(s)) {
            return true;
        }
        String td = full.getTotalDebit().setScale(2, RoundingMode.HALF_UP).toPlainString();
        String tc = full.getTotalCredit().setScale(2, RoundingMode.HALF_UP).toPlainString();
        String compact = raw.replaceAll(",", "").trim();
        if (td.contains(compact) || tc.contains(compact)) {
            return true;
        }
        String digits = raw.replaceAll("[^0-9.]", "");
        if (!digits.isBlank() && (td.contains(digits) || tc.contains(digits))) {
            return true;
        }
        for (JournalLine l : full.getLines()) {
            Account a = l.getAccount();
            if (a.getAccountName() != null && a.getAccountName().toLowerCase(Locale.ROOT).contains(s)) {
                return true;
            }
            if (a.getAccountNumber() != null && a.getAccountNumber().toLowerCase(Locale.ROOT).contains(s)) {
                return true;
            }
        }
        return false;
    }

    private JournalEntryListItem toListItem(JournalEntry e) {
        return new JournalEntryListItem(
                e.getId(),
                e.getEntryDate(),
                e.getEntryType(),
                e.getDescription(),
                e.getTotalDebit(),
                e.getTotalCredit(),
                e.getStatus(),
                e.getCreatedByUserId(),
                usernameFor(e.getCreatedByUserId())
        );
    }

    private String usernameFor(Long userId) {
        if (userId == null) {
            return "—";
        }
        return userRepository.findById(userId).map(User::getUsername).orElse("—");
    }

    @Transactional(readOnly = true)
    public JournalEntryDetail getDetail(Long id) {
        JournalEntry e = journalEntryRepository.findDetailById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Journal entry not found."));
        List<JournalLineOut> lines = e.getLines().stream()
                .map(l -> new JournalLineOut(
                        l.getLineType(),
                        l.getAccount().getAccountNumber(),
                        l.getAccount().getAccountName(),
                        l.getAmount(),
                        l.getDescription()
                ))
                .toList();
        List<JournalAttachmentOut> atts = e.getAttachments().stream()
                .map(a -> new JournalAttachmentOut(a.getId(), a.getFilename()))
                .toList();
        return new JournalEntryDetail(
                e.getId(),
                e.getEntryDate(),
                e.getEntryType(),
                e.getDescription(),
                e.getTotalDebit(),
                e.getTotalCredit(),
                e.getStatus(),
                e.getCreatedByUserId(),
                usernameFor(e.getCreatedByUserId()),
                e.getRejectionReason(),
                lines,
                atts
        );
    }

    @Transactional
    public String createFromMultipart(CreateJournalRequest req, List<MultipartFile> files, Long actingUserId) {
        validateCreateRequest(req);

        Long creator = actingUserId != null ? actingUserId : req.createdByUserId();
        LocalDateTime now = LocalDateTime.now();

        BigDecimal totalDebit = BigDecimal.ZERO;
        BigDecimal totalCredit = BigDecimal.ZERO;
        List<JournalLine> lineEntities = new ArrayList<>();

        for (LineIn line : req.lines()) {
            String lt = line.type().trim().toUpperCase(Locale.ROOT);
            Account acc = accountRepository.findById(line.accountId())
                    .orElseThrow(() -> new IllegalArgumentException("Unknown account id: " + line.accountId()));
            if (!acc.isActive()) {
                throw new IllegalArgumentException("Account " + acc.getAccountNumber() + " is inactive.");
            }
            BigDecimal amt = scaleMoney(line.amount());
            if (amt.compareTo(BigDecimal.ZERO) <= 0) {
                throw new IllegalArgumentException("Each line must have a positive amount.");
            }
            JournalLine jl = new JournalLine();
            jl.setAccount(acc);
            jl.setLineType(lt);
            jl.setAmount(amt);
            jl.setDescription(line.description() != null ? line.description().trim() : null);
            jl.setCreatedAt(now);
            lineEntities.add(jl);
            if ("DEBIT".equals(lt)) {
                totalDebit = totalDebit.add(amt);
            } else {
                totalCredit = totalCredit.add(amt);
            }
        }

        if (totalDebit.subtract(totalCredit).abs().compareTo(new BigDecimal("0.01")) >= 0) {
            throw new IllegalArgumentException("Total debits must equal total credits.");
        }

        String entryType = req.entryType().trim().toUpperCase(Locale.ROOT);
        JournalEntry entry = new JournalEntry();
        entry.setEntryDate(req.date());
        entry.setDescription(req.description() != null ? req.description().trim() : null);
        entry.setEntryType(entryType);
        entry.setStatus(STATUS_PENDING);
        entry.setTotalDebit(totalDebit);
        entry.setTotalCredit(totalCredit);
        entry.setCreatedByUserId(creator);
        entry.setSubmittedAt(now);
        entry.setCreatedAt(now);
        entry.setAdjusting("ADJUSTING".equals(entryType));

        for (JournalLine jl : lineEntities) {
            entry.addLine(jl);
        }

        if (files != null) {
            for (MultipartFile f : files) {
                if (f == null || f.isEmpty()) {
                    continue;
                }
                validateAttachment(f);
                JournalAttachment ja = new JournalAttachment();
                ja.setFilename(safeFilename(f.getOriginalFilename()));
                ja.setContentType(f.getContentType() != null ? f.getContentType() : "application/octet-stream");
                try {
                    ja.setData(f.getBytes());
                } catch (IOException ex) {
                    throw new IllegalArgumentException("Could not read attachment: " + f.getOriginalFilename());
                }
                ja.setUploadedAt(now);
                entry.addAttachment(ja);
            }
        }

        journalEntryRepository.save(entry);
        notificationService.notifyJournalPendingApproval(entry.getId(), creator);
        return "Journal entry submitted for approval.";
    }

    private void validateCreateRequest(CreateJournalRequest req) {
        if (req == null) {
            throw new IllegalArgumentException("Request body required.");
        }
        if (req.date() == null) {
            throw new IllegalArgumentException("Entry date is required.");
        }
        if (req.entryType() == null || req.entryType().isBlank()) {
            throw new IllegalArgumentException("Entry type is required.");
        }
        if (!ENTRY_TYPES.contains(req.entryType().trim().toUpperCase(Locale.ROOT))) {
            throw new IllegalArgumentException("Entry type must be REGULAR or ADJUSTING.");
        }
        if (req.lines() == null || req.lines().isEmpty()) {
            throw new IllegalArgumentException("At least one journal line is required.");
        }
        long debits = req.lines().stream()
                .filter(l -> "DEBIT".equalsIgnoreCase(l.type()))
                .count();
        long credits = req.lines().stream()
                .filter(l -> "CREDIT".equalsIgnoreCase(l.type()))
                .count();
        if (debits < 1) {
            throw new IllegalArgumentException("At least one debit line is required.");
        }
        if (credits < 1) {
            throw new IllegalArgumentException("At least one credit line is required.");
        }
        for (LineIn line : req.lines()) {
            if (line.type() == null || !LINE_TYPES.contains(line.type().trim().toUpperCase(Locale.ROOT))) {
                throw new IllegalArgumentException("Each line must be DEBIT or CREDIT.");
            }
            if (line.accountId() == null) {
                throw new IllegalArgumentException("Each line needs accountId.");
            }
            if (line.amount() == null) {
                throw new IllegalArgumentException("Each line needs an amount.");
            }
        }
    }

    private void validateAttachment(MultipartFile f) {
        String name = f.getOriginalFilename();
        if (name == null || !name.contains(".")) {
            throw new IllegalArgumentException("Attachment must have a file extension.");
        }
        String ext = name.substring(name.lastIndexOf('.') + 1).toLowerCase(Locale.ROOT);
        if (!ALLOWED_EXT.contains(ext)) {
            throw new IllegalArgumentException("File type not allowed: " + ext);
        }
    }

    private static String safeFilename(String name) {
        if (name == null || name.isBlank()) {
            return "attachment";
        }
        return name.replaceAll("[\\\\/:*?\"<>|]", "_").trim();
    }

    @Transactional
    public void approve(Long entryId, Long reviewerUserId) {
        requireManagerOrAdmin(reviewerUserId);
        JournalEntry e = journalEntryRepository.findDetailById(entryId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Journal entry not found."));
        if (!STATUS_PENDING.equals(e.getStatus())) {
            throw new IllegalArgumentException("Only pending entries can be approved.");
        }
        postJournalToLedger(e);
        e.setStatus(STATUS_APPROVED);
        e.setApprovedByUserId(reviewerUserId);
        e.setApprovedAt(LocalDateTime.now());
        e.setRejectionReason(null);
        journalEntryRepository.save(e);
    }

    /**
     * Creates {@link LedgerEntry} rows and updates {@link Account} debit/credit/balance for each journal line.
     * Idempotent guard: refuses if this journal already has ledger rows.
     */
    private void postJournalToLedger(JournalEntry e) {
        if (ledgerEntryRepository.countByJournalEntry_Id(e.getId()) > 0) {
            throw new IllegalArgumentException("This journal entry has already been posted to the ledger.");
        }
        List<JournalLine> sorted = e.getLines().stream()
                .sorted(Comparator.comparing(JournalLine::getId))
                .toList();
        if (sorted.isEmpty()) {
            throw new IllegalArgumentException("Journal entry has no lines to post.");
        }
        LocalDateTime entryTs = LocalDateTime.of(e.getEntryDate(), LocalTime.NOON);
        LocalDateTime now = LocalDateTime.now();
        for (JournalLine jl : sorted) {
            Long accId = jl.getAccount().getId();
            Account acc = accountRepository.findById(accId)
                    .orElseThrow(() -> new IllegalArgumentException("Account not found: " + accId));
            BigDecimal amt = scaleMoney(jl.getAmount());
            BigDecimal d = BigDecimal.ZERO;
            BigDecimal c = BigDecimal.ZERO;
            String lt = jl.getLineType() != null ? jl.getLineType().trim().toUpperCase(Locale.ROOT) : "";
            if ("DEBIT".equals(lt)) {
                d = amt;
            } else if ("CREDIT".equals(lt)) {
                c = amt;
            } else {
                throw new IllegalArgumentException("Invalid line type: " + jl.getLineType());
            }
            acc.setDebit(scaleMoney(acc.getDebit().add(d)));
            acc.setCredit(scaleMoney(acc.getCredit().add(c)));
            BigDecimal bal = scaleMoney(acc.getInitialBalance().add(acc.getDebit()).subtract(acc.getCredit()));
            acc.setBalance(bal);
            accountRepository.save(acc);

            LedgerEntry le = new LedgerEntry();
            le.setAccount(acc);
            le.setJournalEntry(e);
            le.setJournalLine(jl);
            le.setEntryDate(entryTs);
            le.setDebitAmount(d);
            le.setCreditAmount(c);
            le.setBalanceAfter(bal);
            String lineDesc = jl.getDescription();
            if (lineDesc == null || lineDesc.isBlank()) {
                lineDesc = e.getDescription();
            }
            if (lineDesc == null || lineDesc.isBlank()) {
                lineDesc = "Journal entry JE-" + e.getId();
            }
            le.setDescription(lineDesc);
            le.setPostReference("JE-" + e.getId());
            le.setCreatedAt(now);
            ledgerEntryRepository.save(le);
        }
    }

    @Transactional
    public void reject(Long entryId, Long reviewerUserId, String reason) {
        requireManagerOrAdmin(reviewerUserId);
        if (reason == null || reason.isBlank()) {
            throw new IllegalArgumentException("A rejection reason is required.");
        }
        JournalEntry e = journalEntryRepository.findById(entryId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Journal entry not found."));
        if (!STATUS_PENDING.equals(e.getStatus())) {
            throw new IllegalArgumentException("Only pending entries can be rejected.");
        }
        e.setStatus(STATUS_REJECTED);
        e.setApprovedByUserId(reviewerUserId);
        e.setApprovedAt(LocalDateTime.now());
        e.setRejectionReason(reason.trim());
        journalEntryRepository.save(e);
    }

    private void requireManagerOrAdmin(Long userId) {
        if (userId == null) {
            throw new IllegalArgumentException("X-User-Id header is required for this action.");
        }
        User u = userRepository.findById(userId)
                .orElseThrow(() -> new IllegalArgumentException("User not found."));
        String role = u.getRole();
        if (!"MANAGER".equals(role) && !"ADMIN".equals(role)) {
            throw new IllegalArgumentException("Only managers or administrators can approve or reject entries.");
        }
    }

    @Transactional(readOnly = true)
    public JournalAttachment downloadAttachment(Long journalId, Long attachmentId) {
        JournalAttachment a = journalAttachmentRepository.findByIdAndJournalId(attachmentId, journalId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Attachment not found."));
        return a;
    }

    private static BigDecimal scaleMoney(BigDecimal v) {
        if (v == null) {
            return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        }
        return v.setScale(2, RoundingMode.HALF_UP);
    }
}
