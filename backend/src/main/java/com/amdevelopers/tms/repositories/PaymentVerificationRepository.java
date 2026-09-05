package com.amdevelopers.tms.repositories;

import com.amdevelopers.tms.entity.Invoice;
import com.amdevelopers.tms.entity.PaymentVerification;
import com.amdevelopers.tms.enums.VerificationStatus;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PaymentVerificationRepository extends JpaRepository<PaymentVerification, Long> {

    List<PaymentVerification> findAllByStatusOrderBySubmittedAtDesc(VerificationStatus status);

    List<PaymentVerification> findAllByInvoiceOrderBySubmittedAtDesc(Invoice invoice);

    Optional<PaymentVerification> findTopByInvoiceAndStatusOrderBySubmittedAtDesc(
            Invoice invoice, VerificationStatus status);

    boolean existsByInvoiceAndStatus(Invoice invoice, VerificationStatus status);
}
