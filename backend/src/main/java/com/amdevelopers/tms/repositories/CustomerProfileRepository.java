package com.amdevelopers.tms.repositories;

import com.amdevelopers.tms.entity.CustomerProfile;
import com.amdevelopers.tms.entity.User;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CustomerProfileRepository extends JpaRepository<CustomerProfile, Long> {

    Optional<CustomerProfile> findByUser(User user);

    boolean existsByUser(User user);
}