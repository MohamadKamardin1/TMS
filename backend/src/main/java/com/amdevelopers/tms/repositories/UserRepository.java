package com.amdevelopers.tms.repositories;

import com.amdevelopers.tms.entity.User;
import com.amdevelopers.tms.enums.Role;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserRepository extends JpaRepository<User, Long> {

    Optional<User> findByUsername(String username);

    boolean existsByUsername(String username);

    boolean existsByEmail(String email);

    List<User> findByRole(Role role);

    List<User> findAllByOrderByCreatedAtDesc();

    long countByRole(Role role);
}
