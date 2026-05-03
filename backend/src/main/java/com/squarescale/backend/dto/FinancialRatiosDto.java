package com.squarescale.backend.dto;

/**
 * JSON keys match {@code frontend/src/dashboard.js} {@code RATIO_DEFS} {@code key} fields.
 */
public record FinancialRatiosDto(
        Double currentRatio,
        Double quickRatio,
        Double debtToEquity,
        Double grossProfitMargin,
        Double netProfitMargin,
        Double returnOnAssets,
        Double returnOnEquity,
        Double assetTurnover,
        Double inventoryTurnover
) {}
