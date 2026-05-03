package com.squarescale.backend.controller;

import com.squarescale.backend.dto.FinancialRatiosDto;
import com.squarescale.backend.service.FinancialRatioService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/reports")
public class ReportController {

    private final FinancialRatioService financialRatioService;

    public ReportController(FinancialRatioService financialRatioService) {
        this.financialRatioService = financialRatioService;
    }

    @GetMapping("/ratios")
    public FinancialRatiosDto ratios() {
        return financialRatioService.compute();
    }
}
