package com.squarescale.backend.controller;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/** JSON payloads for financial statements (Part 3). */
public final class FinancialReportDtos {

    private FinancialReportDtos() {}

    public record TrialBalanceRow(
            String accountNumber,
            String accountName,
            String normalSide,
            BigDecimal debit,
            BigDecimal credit
    ) {}

    public record TrialBalanceReport(
            LocalDate asOf,
            List<TrialBalanceRow> rows,
            BigDecimal totalDebit,
            BigDecimal totalCredit
    ) {}

    public record BalanceSheetLine(
            String accountNumber,
            String accountName,
            BigDecimal amount
    ) {}

    public record BalanceSheetReport(
            LocalDate asOf,
            List<BalanceSheetLine> assets,
            List<BalanceSheetLine> liabilities,
            List<BalanceSheetLine> equity,
            BigDecimal totalAssets,
            BigDecimal totalLiabilities,
            BigDecimal totalEquity
    ) {}

    public record IncomeStatementLine(
            String accountNumber,
            String accountName,
            String lineType,
            BigDecimal amount
    ) {}

    public record IncomeStatementReport(
            LocalDate dateFrom,
            LocalDate dateTo,
            List<IncomeStatementLine> revenues,
            List<IncomeStatementLine> expenses,
            BigDecimal totalRevenue,
            BigDecimal totalExpense,
            BigDecimal netIncome
    ) {}

    public record RetainedEarningsReport(
            LocalDate asOf,
            LocalDate periodFrom,
            LocalDate periodTo,
            BigDecimal retainedEarningsBeginning,
            BigDecimal netIncome,
            BigDecimal retainedEarningsEnding,
            List<BalanceSheetLine> retainedEarningsAccounts
    ) {}
}
