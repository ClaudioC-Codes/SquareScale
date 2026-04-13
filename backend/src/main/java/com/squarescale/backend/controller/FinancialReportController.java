package com.squarescale.backend.controller;

import com.squarescale.backend.controller.FinancialReportDtos.IncomeStatementReport;
import com.squarescale.backend.controller.FinancialReportDtos.RetainedEarningsReport;
import com.squarescale.backend.service.FinancialReportService;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;

/**
 * Financial statements for managers and accountants (chart + posted journal activity).
 */
@RestController
@RequestMapping("/reports")
public class FinancialReportController {

    private final FinancialReportService financialReportService;

    public FinancialReportController(FinancialReportService financialReportService) {
        this.financialReportService = financialReportService;
    }

    @GetMapping("/trial-balance")
    public ResponseEntity<?> trialBalance(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate asOf
    ) {
        return ResponseEntity.ok(financialReportService.trialBalance(asOf));
    }

    @GetMapping("/balance-sheet")
    public ResponseEntity<?> balanceSheet(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate asOf
    ) {
        return ResponseEntity.ok(financialReportService.balanceSheet(asOf));
    }

    @GetMapping("/income-statement")
    public ResponseEntity<?> incomeStatement(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateFrom,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dateTo
    ) {
        try {
            IncomeStatementReport r = financialReportService.incomeStatement(dateFrom, dateTo);
            return ResponseEntity.ok(r);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }

    @GetMapping("/retained-earnings")
    public ResponseEntity<?> retainedEarnings(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate asOf,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate periodFrom,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate periodTo
    ) {
        try {
            RetainedEarningsReport r = financialReportService.retainedEarnings(asOf, periodFrom, periodTo);
            return ResponseEntity.ok(r);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(e.getMessage());
        }
    }
}
