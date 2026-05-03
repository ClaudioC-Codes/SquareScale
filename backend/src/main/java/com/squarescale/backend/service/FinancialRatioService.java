package com.squarescale.backend.service;

import com.squarescale.backend.dto.FinancialRatiosDto;
import com.squarescale.backend.entity.Account;
import com.squarescale.backend.repository.AccountRepository;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;
import java.util.Locale;
import java.util.function.Predicate;

/**
 * Computes dashboard ratios from chart-of-accounts balances (and account-number / subcategory heuristics).
 */
@Service
public class FinancialRatioService {

    private final AccountRepository accountRepo;

    public FinancialRatioService(AccountRepository accountRepo) {
        this.accountRepo = accountRepo;
    }

    public FinancialRatiosDto compute() {
        List<Account> all = accountRepo.findAll().stream()
                .filter(Account::isActive)
                .toList();

        BigDecimal currentAssets = sumWhere(all, isAsset().and(isCurrentSubcategory()));
        // Credit-normal liabilities often store negative balances; use magnitude for ratio denominators.
        BigDecimal currentLiab = sumWhereAbs(all, isLiability().and(isCurrentSubcategory()));
        BigDecimal totalAssets = sumWhere(all, isAsset());
        BigDecimal totalLiab = sumWhereAbs(all, isLiability());
        BigDecimal equity = sumWhere(all, isEquity());
        BigDecimal inventory = sumWhere(all, isAsset().and(isInventory()));

        BigDecimal revenue = sumRevenue(all);
        BigDecimal cogs = sumCogs(all);
        BigDecimal expenses = sumExpenses(all);

        BigDecimal grossProfit = revenue.subtract(cogs);
        BigDecimal netIncome = revenue.subtract(expenses);

        Double currentRatio = ratio(firstNonZero(currentAssets, totalAssets), firstNonZero(currentLiab, totalLiab));
        BigDecimal quickNum = currentAssets.subtract(inventory).max(BigDecimal.ZERO);
        Double quickRatio = ratio(quickNum, firstNonZero(currentLiab, totalLiab));
        BigDecimal equityMag = equity != null && equity.compareTo(BigDecimal.ZERO) != 0
                ? equity.abs() : null;
        Double debtToEquity = ratio(totalLiab, equityMag);

        Double grossMargin = percentRatio(grossProfit, revenue);
        Double netMargin = percentRatio(netIncome, revenue);
        Double roa = percentRatio(netIncome, totalAssets);
        Double roe = percentRatio(netIncome, equity);
        Double assetTurnover = ratio(revenue, totalAssets);
        Double invTurnover = ratio(cogs, inventory);

        return new FinancialRatiosDto(
                currentRatio,
                quickRatio,
                debtToEquity,
                grossMargin,
                netMargin,
                roa,
                roe,
                assetTurnover,
                invTurnover
        );
    }

    private static BigDecimal firstNonZero(BigDecimal preferred, BigDecimal fallback) {
        if (preferred != null && preferred.compareTo(BigDecimal.ZERO) > 0) {
            return preferred;
        }
        return fallback != null ? fallback : BigDecimal.ZERO;
    }

    private static Double ratio(BigDecimal numerator, BigDecimal denominator) {
        if (numerator == null || denominator == null
                || denominator.compareTo(BigDecimal.ZERO) == 0) {
            return null;
        }
        return numerator.divide(denominator, 6, RoundingMode.HALF_UP).doubleValue();
    }

    private static Double percentRatio(BigDecimal numerator, BigDecimal denominator) {
        if (numerator == null || denominator == null
                || denominator.compareTo(BigDecimal.ZERO) == 0) {
            return null;
        }
        return numerator.multiply(BigDecimal.valueOf(100))
                .divide(denominator, 4, RoundingMode.HALF_UP)
                .doubleValue();
    }

    private static BigDecimal sumWhere(List<Account> accounts, Predicate<Account> pred) {
        return accounts.stream()
                .filter(pred)
                .map(Account::getBalance)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private static BigDecimal sumWhereAbs(List<Account> accounts, Predicate<Account> pred) {
        return accounts.stream()
                .filter(pred)
                .map(a -> a.getBalance().abs())
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private static Predicate<Account> isAsset() {
        return a -> safeCat(a).toLowerCase(Locale.ROOT).contains("asset")
                || a.getAccountNumber().startsWith("1");
    }

    private static Predicate<Account> isLiability() {
        return a -> safeCat(a).toLowerCase(Locale.ROOT).contains("liabilit")
                || a.getAccountNumber().startsWith("2");
    }

    private static Predicate<Account> isEquity() {
        return a -> safeCat(a).toLowerCase(Locale.ROOT).contains("equity")
                || a.getAccountNumber().startsWith("3");
    }

    private static String safeCat(Account a) {
        String c = a.getAccountCategory();
        return c == null ? "" : c.trim();
    }

    private static Predicate<Account> isCurrentSubcategory() {
        return a -> {
            String s = a.getAccountSubcategory();
            if (s == null) {
                return false;
            }
            return s.toLowerCase(Locale.ROOT).contains("current");
        };
    }

    private static Predicate<Account> isInventory() {
        return a -> {
            String name = a.getAccountName() != null ? a.getAccountName().toLowerCase(Locale.ROOT) : "";
            String sub = a.getAccountSubcategory() != null ? a.getAccountSubcategory().toLowerCase(Locale.ROOT) : "";
            return name.contains("inventory") || sub.contains("inventory");
        };
    }

    /** Revenue: account numbers starting with 4 (class convention) or other IS / credit-normal P&L accounts. */
    private static BigDecimal sumRevenue(List<Account> accounts) {
        BigDecimal sum = BigDecimal.ZERO;
        for (Account a : accounts) {
            if (a.getAccountNumber().startsWith("4")) {
                sum = sum.add(a.getBalance().abs());
            } else if ("IS".equalsIgnoreCase(a.getStatementType())
                    && "CREDIT".equalsIgnoreCase(a.getNormalSide())
                    && !a.getAccountNumber().startsWith("5")) {
                sum = sum.add(a.getBalance().abs());
            }
        }
        return sum;
    }

    private static BigDecimal sumExpenses(List<Account> accounts) {
        BigDecimal sum = BigDecimal.ZERO;
        for (Account a : accounts) {
            if (a.getAccountNumber().startsWith("5")) {
                sum = sum.add(a.getBalance().abs());
            } else if ("IS".equalsIgnoreCase(a.getStatementType())
                    && "DEBIT".equalsIgnoreCase(a.getNormalSide())) {
                sum = sum.add(a.getBalance().abs());
            }
        }
        return sum;
    }

    private static BigDecimal sumCogs(List<Account> accounts) {
        BigDecimal sum = BigDecimal.ZERO;
        for (Account a : accounts) {
            String name = a.getAccountName() != null ? a.getAccountName().toLowerCase(Locale.ROOT) : "";
            String sub = a.getAccountSubcategory() != null ? a.getAccountSubcategory().toLowerCase(Locale.ROOT) : "";
            boolean cogsName = name.contains("cogs") || name.contains("cost of goods") || name.contains("cost of sales");
            boolean cogsSub = sub.contains("cogs") || sub.contains("cost of goods");
            if (cogsName || cogsSub || (a.getAccountNumber().startsWith("5") && (cogsName || cogsSub))) {
                sum = sum.add(a.getBalance().abs());
            }
        }
        if (sum.compareTo(BigDecimal.ZERO) == 0) {
            // Fallback: treat all 5xxx as COGS for margin if no explicit COGS labels (demo data).
            boolean anyExpense = accounts.stream().anyMatch(x -> x.getAccountNumber().startsWith("5"));
            if (anyExpense) {
                return sumExpenses(accounts);
            }
        }
        return sum;
    }
}
