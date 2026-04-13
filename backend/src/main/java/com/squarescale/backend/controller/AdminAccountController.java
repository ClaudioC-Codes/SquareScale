package com.squarescale.backend.controller;

import com.squarescale.backend.entity.Account;
import com.squarescale.backend.entity.User;
import com.squarescale.backend.repository.AccountRepository;
import com.squarescale.backend.repository.UserRepository;
import com.squarescale.backend.service.AuditLogService;
import com.squarescale.backend.service.LedgerService;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.Set;

/**
 * Chart of accounts: add, view, edit, deactivate, search/filter, ledger view, audit logging.
 */
@RestController
@RequestMapping("/admin/accounts")
public class AdminAccountController {

    private static final Set<String> STATEMENT_TYPES = Set.of("IS", "BS", "RE");
    private static final Set<String> NORMAL_SIDES = Set.of("DEBIT", "CREDIT");
    private static final Set<String> ACCOUNT_CATEGORIES = Set.of("Asset", "Liability", "Equity");

    private final AccountRepository accountRepo;
    private final UserRepository userRepo;
    private final AuditLogService auditLogService;
    private final LedgerService ledgerService;

    public AdminAccountController(
            AccountRepository accountRepo,
            UserRepository userRepo,
            AuditLogService auditLogService,
            LedgerService ledgerService
    ) {
        this.accountRepo = accountRepo;
        this.userRepo = userRepo;
        this.auditLogService = auditLogService;
        this.ledgerService = ledgerService;
    }

    public record AccountRequest(
            String accountName,
            String accountNumber,
            String description,
            String normalSide,
            String accountCategory,
            String accountSubcategory,
            BigDecimal initialBalance,
            BigDecimal debit,
            BigDecimal credit,
            BigDecimal balance,
            Long userId,
            String accountOrder,
            String statementType,
            String commentText
    ) {}

    public record LedgerLine(
            LocalDateTime date,
            String description,
            Long journalEntryId,
            BigDecimal debit,
            BigDecimal credit,
            BigDecimal balance
    ) {}

    public record LedgerResponse(Account account, List<LedgerLine> lines) {}

    /**
     * List accounts with optional search (name OR number) and filters (AND).
     */
    @GetMapping
    public List<Account> list(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String name,
            @RequestParam(required = false) String accountNumber,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String subcategory,
            @RequestParam(required = false) BigDecimal minBalance,
            @RequestParam(required = false) BigDecimal maxBalance,
            @RequestParam(required = false) Boolean active
    ) {
        List<Account> all = accountRepo.findAll();
        return filterAccounts(all, search, name, accountNumber, category, subcategory, minBalance, maxBalance, active);
    }

    @GetMapping("/{id}/ledger")
    public ResponseEntity<LedgerResponse> ledger(
            @PathVariable Long id,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateFrom,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateTo,
            @RequestParam(required = false) String search
    ) {
        Optional<Account> opt = accountRepo.findById(id);
        if (opt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        Account a = opt.get();
        List<LedgerLine> lines = ledgerService.getLinesForAccount(id, dateFrom, dateTo, search).stream()
                .map(r -> new LedgerLine(
                        r.date(),
                        r.description(),
                        r.journalEntryId(),
                        r.debit(),
                        r.credit(),
                        r.balance()
                ))
                .toList();
        return ResponseEntity.ok(new LedgerResponse(a, lines));
    }

    @GetMapping("/{id}")
    public ResponseEntity<Account> getOne(@PathVariable Long id) {
        return accountRepo.findById(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    public ResponseEntity<String> create(
            @RequestBody AccountRequest req,
            @RequestHeader(value = "X-User-Id", required = false) Long headerUserId
    ) {
        ResponseEntity<String> forbidden = requireAdministrator(headerUserId);
        if (forbidden != null) {
            return forbidden;
        }

        String err = validateRequest(req, true);
        if (err != null) {
            return ResponseEntity.badRequest().body(err);
        }

        if (accountRepo.existsByAccountNumber(req.accountNumber().trim())) {
            return ResponseEntity.badRequest().body("Duplicate account number is not allowed.");
        }
        if (accountRepo.existsByAccountNameIgnoreCase(req.accountName().trim())) {
            return ResponseEntity.badRequest().body("Duplicate account name is not allowed.");
        }

        Account a = new Account();
        copyRequestToEntity(req, a, true);
        a.setCreatedAt(LocalDateTime.now());
        a.setActive(true);
        accountRepo.save(a);

        auditLogService.logAccountCreate(headerUserId, a);
        return ResponseEntity.ok("Account created with id " + a.getId());
    }

    @PutMapping("/{id}")
    public ResponseEntity<String> update(
            @PathVariable Long id,
            @RequestBody AccountRequest req,
            @RequestHeader(value = "X-User-Id", required = false) Long headerUserId
    ) {
        ResponseEntity<String> forbidden = requireAdministrator(headerUserId);
        if (forbidden != null) {
            return forbidden;
        }

        Optional<Account> opt = accountRepo.findById(id);
        if (opt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        String err = validateRequest(req, false);
        if (err != null) {
            return ResponseEntity.badRequest().body(err);
        }

        String num = req.accountNumber().trim();
        String name = req.accountName().trim();
        if (accountRepo.existsByAccountNumberAndIdNot(num, id)) {
            return ResponseEntity.badRequest().body("Duplicate account number is not allowed.");
        }
        if (accountRepo.existsByAccountNameIgnoreCaseAndIdNot(name, id)) {
            return ResponseEntity.badRequest().body("Duplicate account name is not allowed.");
        }

        Account a = opt.get();
        copyRequestToEntity(req, a, false);
        accountRepo.save(a);

        auditLogService.logAccountUpdate(headerUserId, a);
        return ResponseEntity.ok("Account updated");
    }

    @PostMapping("/{id}/deactivate")
    public ResponseEntity<String> deactivate(
            @PathVariable Long id,
            @RequestHeader(value = "X-User-Id", required = false) Long headerUserId
    ) {
        ResponseEntity<String> forbidden = requireAdministrator(headerUserId);
        if (forbidden != null) {
            return forbidden;
        }

        Optional<Account> opt = accountRepo.findById(id);
        if (opt.isEmpty()) {
            return ResponseEntity.notFound().build();
        }
        Account a = opt.get();
        BigDecimal bal = scaleMoney(a.getBalance());
        if (bal.compareTo(BigDecimal.ZERO) > 0) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST)
                    .body("Accounts with balance greater than zero cannot be deactivated.");
        }
        a.setActive(false);
        accountRepo.save(a);

        auditLogService.logAccountDeactivate(headerUserId, a);
        return ResponseEntity.ok("Account deactivated");
    }

    private static List<Account> filterAccounts(
            List<Account> all,
            String search,
            String name,
            String accountNumber,
            String category,
            String subcategory,
            BigDecimal minBalance,
            BigDecimal maxBalance,
            Boolean active
    ) {
        List<Account> out = new ArrayList<>();
        for (Account a : all) {
            if (matches(a, search, name, accountNumber, category, subcategory, minBalance, maxBalance, active)) {
                out.add(a);
            }
        }
        return out;
    }

    private static boolean matches(
            Account a,
            String search,
            String name,
            String accountNumber,
            String category,
            String subcategory,
            BigDecimal minBalance,
            BigDecimal maxBalance,
            Boolean active
    ) {
        if (search != null && !search.isBlank()) {
            String s = search.trim().toLowerCase();
            String num = a.getAccountNumber() != null ? a.getAccountNumber() : "";
            boolean hit = a.getAccountName().toLowerCase().contains(s) || num.contains(s.trim());
            if (!hit) {
                return false;
            }
        }
        if (name != null && !name.isBlank()) {
            if (!a.getAccountName().toLowerCase().contains(name.trim().toLowerCase())) {
                return false;
            }
        }
        if (accountNumber != null && !accountNumber.isBlank()) {
            if (!a.getAccountNumber().contains(accountNumber.trim())) {
                return false;
            }
        }
        if (category != null && !category.isBlank()) {
            if (!a.getAccountCategory().toLowerCase().contains(category.trim().toLowerCase())) {
                return false;
            }
        }
        if (subcategory != null && !subcategory.isBlank()) {
            if (!a.getAccountSubcategory().toLowerCase().contains(subcategory.trim().toLowerCase())) {
                return false;
            }
        }
        if (minBalance != null) {
            if (a.getBalance().compareTo(scaleMoney(minBalance)) < 0) {
                return false;
            }
        }
        if (maxBalance != null) {
            if (a.getBalance().compareTo(scaleMoney(maxBalance)) > 0) {
                return false;
            }
        }
        if (active != null) {
            if (a.isActive() != active) {
                return false;
            }
        }
        return true;
    }

    private void copyRequestToEntity(AccountRequest req, Account a, boolean isNew) {
        a.setAccountName(req.accountName().trim());
        a.setAccountNumber(req.accountNumber().trim());
        a.setDescription(req.description() != null ? req.description().trim() : null);
        String ns = req.normalSide().trim().toUpperCase();
        a.setNormalSide("DEBIT".equals(ns) ? "Debit" : "Credit");
        a.setAccountCategory(req.accountCategory().trim());
        a.setAccountSubcategory(req.accountSubcategory().trim());
        BigDecimal init = scaleMoney(req.initialBalance());
        BigDecimal deb = scaleMoney(req.debit());
        BigDecimal cred = scaleMoney(req.credit());
        a.setInitialBalance(init);
        a.setDebit(deb);
        a.setCredit(cred);
        BigDecimal bal = req.balance() != null ? scaleMoney(req.balance()) : init.add(deb).subtract(cred);
        a.setBalance(bal);
        if (isNew) {
            a.setUserId(req.userId());
        } else if (req.userId() != null) {
            a.setUserId(req.userId());
        }
        a.setAccountOrder(req.accountOrder().trim());
        a.setStatementType(req.statementType().trim().toUpperCase());
        a.setCommentText(req.commentText() != null ? req.commentText().trim() : null);
    }

    private String validateRequest(AccountRequest req, boolean create) {
        if (req == null) {
            return "Request body required";
        }
        if (req.accountName() == null || req.accountName().isBlank()) {
            return "Account name is required";
        }
        if (req.accountNumber() == null || req.accountNumber().isBlank()) {
            return "Account number is required";
        }
        if (req.normalSide() == null || req.normalSide().isBlank()) {
            return "Normal side is required";
        }
        if (req.accountCategory() == null || req.accountCategory().isBlank()) {
            return "Account category is required";
        }
        if (!ACCOUNT_CATEGORIES.contains(req.accountCategory().trim())) {
            return "Account category must be Asset, Liability, or Equity.";
        }
        if (req.accountSubcategory() == null || req.accountSubcategory().isBlank()) {
            return "Account subcategory is required";
        }
        if (create && req.userId() == null) {
            return "User id is required";
        }
        if (req.accountOrder() == null || req.accountOrder().isBlank()) {
            return "Order is required";
        }
        if (req.statementType() == null || req.statementType().isBlank()) {
            return "Statement is required";
        }

        String num = req.accountNumber().trim();
        if (!num.matches("[0-9]+")) {
            return "Account number must contain digits only (no decimals or letters).";
        }
        if (num.charAt(0) < '1' || num.charAt(0) > '5') {
            return "Account number must start with 1–5 (assets, liabilities, equity, revenue, expense).";
        }

        String ns = req.normalSide().trim().toUpperCase();
        if (!NORMAL_SIDES.contains(ns)) {
            return "Normal side must be Debit or Credit.";
        }

        String st = req.statementType().trim().toUpperCase();
        if (!STATEMENT_TYPES.contains(st)) {
            return "Statement must be IS, BS, or RE.";
        }

        if (req.initialBalance() == null || req.debit() == null || req.credit() == null) {
            return "Initial balance, debit, and credit are required.";
        }

        return null;
    }

    private static BigDecimal scaleMoney(BigDecimal v) {
        if (v == null) {
            return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        }
        return v.setScale(2, RoundingMode.HALF_UP);
    }

    /**
     * Only administrators may create, update, or deactivate accounts.
     * Managers and regular users may only use GET endpoints (view / ledger).
     */
    private ResponseEntity<String> requireAdministrator(Long headerUserId) {
        if (headerUserId == null) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body("Account changes require an administrator. Send header X-User-Id.");
        }
        Optional<User> actor = userRepo.findById(headerUserId);
        if (actor.isEmpty() || !"ADMIN".equalsIgnoreCase(actor.get().getRole())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                    .body("Only administrators can add, edit, or deactivate accounts.");
        }
        return null;
    }
}
