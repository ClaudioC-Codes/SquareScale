// Controller for admin-only operations (create/update users, activate/deactivate, suspend, reports).
package com.squarescale.backend.controller;

import com.squarescale.backend.entity.User;
import com.squarescale.backend.repository.UserRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

/** Exposes REST endpoints under /admin for user management. */
@RestController
@RequestMapping("/admin")
public class AdminController {

    // Roles allowed when creating or updating a user.
    private static final Set<String> ALLOWED_ROLES = Set.of("ADMIN", "MANAGER", "USER", "ACCOUNTANT");

    private final UserRepository userRepo;
    private final PasswordEncoder passwordEncoder;

    public AdminController(UserRepository userRepo, PasswordEncoder passwordEncoder) {
        this.userRepo = userRepo;
        this.passwordEncoder = passwordEncoder;
    }

    /** Request body for updating a user; newPassword is optional (if provided, stored encrypted). */
    public record UpdateUserRequest(String firstName, String lastName, String email, String role, String newPassword) {}

    // ----- Endpoints -----

    /** GET /admin/users – Return all users (e.g. for the admin report). */
    @GetMapping("/users")
    public List<User> getAllUsers() {
        return userRepo.findAll();
    }

    /** POST /admin/users – Create a new user; username is auto-generated from first name, last name, and current month/year. */
    @PostMapping("/users")
    public ResponseEntity<String> createUser(@RequestBody User user) {
        // Require first and last name so we can generate the username.
        if (user.getFirstName() == null || user.getLastName() == null) {
            return ResponseEntity.badRequest().body("First name and last name are required");
        }

        if (!isValidRole(user.getRole())) {
            return ResponseEntity.badRequest().body("Invalid role. Allowed roles: ADMIN, MANAGER, USER, ACCOUNTANT");
        }

        // Format: first initial + last name + MMyy (e.g. jdoe0326).
        String generatedUsername = generateUsername(user);

        // Usernames must be unique.
        if (userRepo.findByUsername(generatedUsername).isPresent()) {
            return ResponseEntity.badRequest().body("Username already exists: " + generatedUsername);
        }

        user.setUsername(generatedUsername);
        user.setPassword(passwordEncoder.encode(user.getPassword()));

        // Assign a new id since the MySQL table's userID is not auto-incrementing.
        Long nextId = userRepo.findAll().stream()
                .mapToLong(u -> u.getId() == null ? 0L : u.getId())
                .max()
                .orElse(0L) + 1L;
        user.setId(nextId);

        // Ensure required audit fields are set so MySQL NOT NULL columns are satisfied.
        if (user.getCreatedAt() == null) {
            user.setCreatedAt(LocalDateTime.now());
        }
        if (user.getPasswordLastSet() == null) {
            user.setPasswordLastSet(LocalDateTime.now());
        }
        // New users should start as active with zero failed attempts.
        user.setActive(true);
        user.setFailedLoginAttempts(0);

        try {
            userRepo.save(user);
            return ResponseEntity.ok("User created with username: " + generatedUsername);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(500).body("Error saving user: " + e.getMessage());
        }
    }

    /** PUT /admin/users/{id} – Update an existing user's name, email, role, and optionally set a new password (stored encrypted). */
    @PutMapping("/users/{id}")
    public ResponseEntity<String> updateUser(@PathVariable Long id, @RequestBody UpdateUserRequest req) {
        if (req == null) return ResponseEntity.badRequest().body("Request body required");
        Optional<User> u = userRepo.findById(id);
        if (u.isEmpty()) return ResponseEntity.notFound().build();
        User user = u.get();

        if (req.firstName() != null) user.setFirstName(req.firstName());
        if (req.lastName() != null) user.setLastName(req.lastName());
        if (req.email() != null) user.setEmail(req.email());
        if (req.role() != null) {
            if (!isValidRole(req.role())) {
                return ResponseEntity.badRequest().body("Invalid role. Allowed roles: ADMIN, MANAGER, USER, ACCOUNTANT");
            }
            user.setRole(req.role());
        }
        if (req.newPassword() != null && !req.newPassword().trim().isEmpty()) {
            user.setPassword(passwordEncoder.encode(req.newPassword().trim()));
            user.setPasswordLastSet(LocalDateTime.now());
        }

        userRepo.save(user);
        return ResponseEntity.ok("User updated");
    }

    /** POST /admin/users/{id}/activate – Restore login: active, clear time suspension and lockout counters. */
    @PostMapping("/users/{id}/activate")
    public ResponseEntity<String> activateUser(@PathVariable Long id) {
        Optional<User> u = userRepo.findById(id);
        if (u.isEmpty()) return ResponseEntity.notFound().build();
        User user = u.get();
        user.setActive(true);
        user.setSuspendedUntil(null);
        user.setFailedLoginAttempts(0);
        userRepo.save(user);
        return ResponseEntity.ok("User activated");
    }

    /** POST /admin/users/{id}/deactivate – Set user as inactive (cannot log in). */
    @PostMapping("/users/{id}/deactivate")
    public ResponseEntity<String> deactivateUser(@PathVariable Long id) {
        Optional<User> u = userRepo.findById(id);
        if (u.isEmpty()) return ResponseEntity.notFound().build();
        User user = u.get();
        user.setActive(false);
        userRepo.save(user);
        return ResponseEntity.ok("User deactivated");
    }

    /** POST /admin/users/{id}/suspend – Suspend user from startDateTime until untilDateTime (e.g. extended leave). */
    @PostMapping("/users/{id}/suspend")
    public ResponseEntity<String> suspendUser(@PathVariable Long id,
                                              @RequestParam String startDateTime,
                                              @RequestParam String untilDateTime) {
        Optional<User> u = userRepo.findById(id);
        if (u.isEmpty()) return ResponseEntity.notFound().build();
        User user = u.get();

        LocalDateTime start = LocalDateTime.parse(startDateTime);
        LocalDateTime suspendUntil = LocalDateTime.parse(untilDateTime);

        user.setSuspendedUntil(suspendUntil);
        user.setActive(false);
        userRepo.save(user);

        return ResponseEntity.ok("User suspended from " + start + " until " + suspendUntil);
    }

    /** GET /admin/users/expired-passwords – List users whose password was last set more than 3 months ago. */
    @GetMapping("/users/expired-passwords")
    public List<User> expiredPasswords() {
        LocalDateTime threeMonthsAgo = LocalDateTime.now().minusMonths(3);
        return userRepo.findByPasswordLastSetBefore(threeMonthsAgo);
    }

    /**
     * Active managers and administrators (for “email from account page” and similar).
     * GET /admin/contact-recipients
     */
    @GetMapping("/contact-recipients")
    public List<StaffContactOut> contactRecipients() {
        return userRepo.findByRoleIdInAndActiveTrue(List.of(2, 3)).stream()
                .sorted(Comparator.comparing(User::getRole).thenComparing(User::getUsername))
                .map(u -> new StaffContactOut(u.getId(), u.getUsername(), u.getEmail(), u.getRole()))
                .collect(Collectors.toList());
    }

    public record StaffContactOut(Long userId, String username, String email, String role) {}

    /** POST /admin/users/{id}/send-email – Send a message to the user's email (currently simulated with console output). */
    @PostMapping("/users/{id}/send-email")
    public ResponseEntity<String> sendEmail(
            @PathVariable Long id,
            @RequestParam String message,
            @RequestParam(required = false) String subject
    ) {
        Optional<User> u = userRepo.findById(id);
        if (u.isEmpty()) return ResponseEntity.notFound().build();
        User user = u.get();

        String subj = subject != null && !subject.isBlank() ? subject.trim() : "(no subject)";
        System.out.println("Email to " + user.getEmail() + " subject=" + subj + " body=" + message);
        return ResponseEntity.ok("Email sent to " + user.getEmail());
    }

    // ----- Helpers -----

    /** Returns true only if role is ADMIN, MANAGER, USER, or ACCOUNTANT (case-insensitive). */
    private boolean isValidRole(String role) {
        if (role == null) {
            return false;
        }
        return ALLOWED_ROLES.contains(role.toUpperCase());
    }

    /** Builds username as: first initial + full last name + MMyy (e.g. jdoe0326 for Jane Doe created in Mar 2026). */
    private String generateUsername(User user) {
        String firstName = user.getFirstName().trim();
        String lastName = user.getLastName().trim();

        String firstInitial = firstName.substring(0, 1).toLowerCase();
        String last = lastName.toLowerCase();

        // MySQL column is varchar(16) in your dump; keep username within that limit.
        int maxLastNameLen = 16 - 1 - 4; // 1 initial + 4 date digits
        if (last.length() > maxLastNameLen) {
            last = last.substring(0, maxLastNameLen);
        }

        String datePart = LocalDate.now().format(DateTimeFormatter.ofPattern("MMyy"));
        return firstInitial + last + datePart;
    }
}