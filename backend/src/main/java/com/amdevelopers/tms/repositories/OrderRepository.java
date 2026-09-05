package com.amdevelopers.tms.repositories;

import com.amdevelopers.tms.entity.CustomerProfile;
import com.amdevelopers.tms.entity.Order;
import com.amdevelopers.tms.entity.User;
import com.amdevelopers.tms.enums.OrderStatus;
import java.util.Collection;
import java.util.List;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.repository.JpaRepository;

public interface OrderRepository extends JpaRepository<Order, Long> {

    List<Order> findByCustomer(CustomerProfile customer, Sort sort);

    List<Order> findByTailor(User tailor, Sort sort);

    List<Order> findByDeliveryAgent(User deliveryAgent, Sort sort);

    /**
     * Count of orders currently assigned to a tailor and still requiring the
     * tailor's work (awaiting estimate or in production/ready). Used to block
     * demoting/deactivating a tailor who still has live assignments.
     */
    long countByTailor_IdAndStatusIn(Long tailorId, Collection<OrderStatus> statuses);

    /**
     * Count of orders currently out for delivery with a delivery agent. Used to
     * block demoting/deactivating an agent mid-run.
     */
    long countByDeliveryAgent_IdAndStatusIn(Long deliveryUserId, Collection<OrderStatus> statuses);
}