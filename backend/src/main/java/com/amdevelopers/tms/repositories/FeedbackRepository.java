package com.amdevelopers.tms.repositories;

import com.amdevelopers.tms.entity.Feedback;
import com.amdevelopers.tms.entity.Order;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface FeedbackRepository extends JpaRepository<Feedback, Long> {

    Optional<Feedback> findByOrder(Order order);
}