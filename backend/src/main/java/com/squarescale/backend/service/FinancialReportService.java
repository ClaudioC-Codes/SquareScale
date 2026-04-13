package com.squarescale.backend.service;

import com.squarescale.backend.controller.FinancialReportDtos.BalanceSheetLine;
import com.squarescale.backend.controller.FinancialReportDtos.BalanceSheetReport;
import com.squarescale.backend.controller.FinancialReportDtos.IncomeStatementLine;
import com.squarescale.backend.controller.FinancialReportDtos.IncomeStatementReport;
import com.squarescale.backend.controller.FinancialReportDtos.RetainedEarningsReport;
import com.squarescale.backend.controller.FinancialReportDtos.TrialBalanceReport;
import com.squarescale.backend.controller.FinancialReportDtos.TrialBalanceRow;
import com.squarescale.backend.entity.Account;
import com.squarescale.backend.entity.LedgerEntry;
import com.squarescale.backend.repository.AccountRepository;
import com.squarescale.backend.repository.LedgerEntryRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Trial balance, balance sheet, income statement, retained earnings.
 * Uses chart-of-accounts balances; income statement activity is summed from posted ledger lines in the date range.
 */
@Service
public class FinancialReportService {

    private static final BigDecimal ZERO = BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);

    private final AccountRepository accountRepository;
    private final LedgerEntryRepository ledgerEntryRepository;

    public FinancialReportService(AccountRepository accountRepository, LedgerEntryRepository ledgerEntryRepository) {
        this.accountRepository = accountRepository;
        this.ledgerEntryRepository = ledgerEntryRepository;
    }

    @Transactional(readOnly = true)
    public TrialBalanceReport trialBalance(LocalDate asOf) {
        LocalDate point = asOf != null ? asOf : LocalDate.now();
        List<Account> accounts = accountRepository.findAll().stream()
                .filter(Account::isActive)
                .sorted(Comparator.comparing(Account::getAccountNumber, Comparator.nullsLast(String::compareTo)))
                .toList();
        List<TrialBalanceRow> rows = new ArrayList<>();
        BigDecimal tDr = ZERO;
        BigDecimal tCr = ZERO;
        for (Account a : accounts) {
            BigDecimal[] dc = trialBalanceColumns(a);
            rows.add(new TrialBalanceRow(
                    a.getAccountNumber(),
                    a.getAccountName(),
                    a.getNormalSide(),
                    dc[0],
                    dc[1]
            ));
            tDr = tDr.add(dc[0]);
            tCr = tCr.add(dc[1]);
        }
        return new TrialBalanceReport(point, rows, scale(tDr), scale(tCr));
    }

    private BigDecimal[] trialBalanceColumns(Account a) {
        BigDecimal b = scale(a.getBalance());
        BigDecimal dr = ZERO;
        BigDecimal cr = ZERO;
        if (isCreditNormal(a)) {
            if (b.compareTo(ZERO) <= 0) {
                cr = b.negate();
            } else {
                dr = b;
            }
        } else {
            if (b.compareTo(ZERO) >= 0) {
                dr = b;
            } else {
                cr = b.negate();
            }
        }
        return new BigDecimal[] { scale(dr), scale(cr) };
    }

    @Transactional(readOnly = true)
    public BalanceSheetReport balanceSheet(LocalDate asOf) {
        LocalDate point = asOf != null ? asOf : LocalDate.now();
        List<Account> accounts = accountRepository.findAll().stream()
                .filter(Account::isActive)
                .filter(a -> "BS".equalsIgnoreCase(a.getStatementType()))
                .sorted(Comparator.comparing(Account::getAccountNumber, Comparator.nullsLast(String::compareTo)))
                .toList();
        List<BalanceSheetLine> assets = new ArrayList<>();
        List<BalanceSheetLine> liabilities = new ArrayList<>();
        List<BalanceSheetLine> equity = new ArrayList<>();
        BigDecimal ta = ZERO;
        BigDecimal tl = ZERO;
        BigDecimal te = ZERO;
        for (Account a : accounts) {
            String cat = a.getAccountCategory() != null ? a.getAccountCategory().trim() : "";
            BigDecimal amt = scale(signedDisplay(a));
            BalanceSheetLine line = new BalanceSheetLine(a.getAccountNumber(), a.getAccountName(), amt);
            if (cat.equalsIgnoreCase("Asset")) {
                assets.add(line);
                ta = ta.add(amt);
            } else if (cat.equalsIgnoreCase("Liability")) {
                liabilities.add(line);
                tl = tl.add(amt);
            } else if (cat.equalsIgnoreCase("Equity")) {
                equity.add(line);
                te = te.add(amt);
            } else {
                if (isCreditNormal(a)) {
                    liabilities.add(line);
                    tl = tl.add(amt);
                } else {
                    assets.add(line);
                    ta = ta.add(amt);
                }
            }
        }
        return new BalanceSheetReport(point, assets, liabilities, equity, scale(ta), scale(tl), scale(te));
    }

    @Transactional(readOnly = true)
    public IncomeStatementReport incomeStatement(LocalDate dateFrom, LocalDate dateTo) {
        LocalDate to = dateTo != null ? dateTo : LocalDate.now();
        LocalDate from = dateFrom != null ? dateFrom : to.withDayOfYear(1);
        if (to.isBefore(from)) {
            throw new IllegalArgumentException("dateTo must be on or after dateFrom.");
        }
        LocalDateTime start = from.atStartOfDay();
        LocalDateTime endExcl = to.plusDays(1).atStartOfDay();
        List<LedgerEntry> entries = ledgerEntryRepository.findEntriesBetween(start, endExcl);

        Map<Long, BigDecimal> revenueAmt = new HashMap<>();
        Map<Long, BigDecimal> expenseAmt = new HashMap<>();
        Map<Long, Account> byId = new HashMap<>();

        for (LedgerEntry le : entries) {
            Account a = le.getAccount();
            if (!"IS".equalsIgnoreCase(a.getStatementType())) {
                continue;
            }
            byId.put(a.getId(), a);
            BigDecimal d = scale(le.getDebitAmount());
            BigDecimal c = scale(le.getCreditAmount());
            if (isCreditNormal(a)) {
                revenueAmt.merge(a.getId(), c.subtract(d), BigDecimal::add);
            } else {
                expenseAmt.merge(a.getId(), d.subtract(c), BigDecimal::add);
            }
        }

        List<IncomeStatementLine> revenues = new ArrayList<>();
        BigDecimal totalRev = ZERO;
        for (Map.Entry<Long, BigDecimal> e : revenueAmt.entrySet()) {
            Account a = byId.get(e.getKey());
            if (a == null) {
                continue;
            }
            BigDecimal amt = scale(e.getValue());
            if (amt.compareTo(ZERO) == 0) {
                continue;
            }
            revenues.add(new IncomeStatementLine(a.getAccountNumber(), a.getAccountName(), "REVENUE", amt));
            totalRev = totalRev.add(amt);
        }
        revenues.sort(Comparator.comparing(IncomeStatementLine::accountNumber));

        List<IncomeStatementLine> expenses = new ArrayList<>();
        BigDecimal totalExp = ZERO;
        for (Map.Entry<Long, BigDecimal> e : expenseAmt.entrySet()) {
            Account a = byId.get(e.getKey());
            if (a == null) {
                continue;
            }
            BigDecimal amt = scale(e.getValue());
            if (amt.compareTo(ZERO) == 0) {
                continue;
            }
            expenses.add(new IncomeStatementLine(a.getAccountNumber(), a.getAccountName(), "EXPENSE", amt));
            totalExp = totalExp.add(amt);
        }
        expenses.sort(Comparator.comparing(IncomeStatementLine::accountNumber));

        BigDecimal net = scale(totalRev.subtract(totalExp));
        return new IncomeStatementReport(from, to, revenues, expenses, scale(totalRev), scale(totalExp), net);
    }

    @Transactional(readOnly = true)
    public RetainedEarningsReport retainedEarnings(LocalDate asOf, LocalDate periodFrom, LocalDate periodTo) {
        LocalDate point = asOf != null ? asOf : LocalDate.now();
        LocalDate to = periodTo != null ? periodTo : point;
        LocalDate from = periodFrom != null ? periodFrom : to.withDayOfYear(1);
        if (to.isBefore(from)) {
            throw new IllegalArgumentException("periodTo must be on or after periodFrom.");
        }

        IncomeStatementReport is = incomeStatement(from, to);
        BigDecimal netIncome = is.netIncome();

        List<Account> reAccounts = accountRepository.findAll().stream()
                .filter(Account::isActive)
                .filter(a -> "RE".equalsIgnoreCase(a.getStatementType()))
                .sorted(Comparator.comparing(Account::getAccountNumber, Comparator.nullsLast(String::compareTo)))
                .toList();

        List<BalanceSheetLine> reLines = new ArrayList<>();
        BigDecimal reEndingFromAccounts = ZERO;
        for (Account a : reAccounts) {
            BigDecimal amt = scale(signedDisplay(a));
            reLines.add(new BalanceSheetLine(a.getAccountNumber(), a.getAccountName(), amt));
            reEndingFromAccounts = reEndingFromAccounts.add(amt);
        }

        BigDecimal ending = scale(reEndingFromAccounts);
        BigDecimal beginning = scale(ending.subtract(netIncome));

        return new RetainedEarningsReport(point, from, to, beginning, netIncome, ending, reLines);
    }

    private BigDecimal signedDisplay(Account a) {
        return isCreditNormal(a) ? scale(a.getBalance().negate()) : scale(a.getBalance());
    }

    private boolean isCreditNormal(Account a) {
        String ns = a.getNormalSide();
        return ns != null && ns.toUpperCase(Locale.ROOT).startsWith("C");
    }

    private static BigDecimal scale(BigDecimal v) {
        if (v == null) {
            return ZERO;
        }
        return v.setScale(2, RoundingMode.HALF_UP);
    }
}
