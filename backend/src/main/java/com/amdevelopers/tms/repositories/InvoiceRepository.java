package com.amdevelopers.tms.repositories;

import com.amdevelopers.tms.entity.Invoice;
import com.amdevelopers.tms.entity.Order;
import com.amdevelopers.tms.enums.InvoiceStatus;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface InvoiceRepository extends JpaRepository<Invoice, Long> {

    Optional<Invoice> findByOrder(Order order);

    List<Invoice> findAllByOrderByCreatedAtDesc();

    List<Invoice> findAllByStatusOrderByCreatedAtDesc(InvoiceStatus status);

    List<Invoice> findAllByStatus(InvoiceStatus status);

    long countByInvoiceNumberStartingWith(String prefix);
}
