package com.squarescale.backend.repository;

import com.squarescale.backend.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;


/**
 * Spring Data JPA repository for the users table. Provides CRUD plus custom queries
 * for login (findByUsername) and expired-password report (findByPasswordLastSetBefore).
 */
public interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findByUsername(String username);

    /** Used by admin expired-passwords report: passwords older than given date. */
    List<User> findByPasswordLastSetBefore(java.time.LocalDateTime dateTime);

    /** Active managers and administrators (for journal approval notifications). */
    List<User> findByRoleIdInAndActiveTrue(Collection<Integer> roleIds);
}