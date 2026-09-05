package com.amdevelopers.tms.repositories;

import com.amdevelopers.tms.entity.CustomerProfile;
import com.amdevelopers.tms.entity.Order;
import com.amdevelopers.tms.entity.User;
import java.util.List;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.repository.JpaRepository;

public interface OrderRepository extends JpaRepository<Order, Long> {

    List<Order> findByCustomer(CustomerProfile customer, Sort sort);

    List<Order> findByTailor(User tailor, Sort sort);

    List<Order> findByDeliveryAgent(User deliveryAgent, Sort sort);
}