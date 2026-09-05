package com.amdevelopers.tms.services;

import com.amdevelopers.tms.dto.PaymentVerificationDTO;
import com.amdevelopers.tms.dto.SubmitPaymentProofDTO;
import com.amdevelopers.tms.entity.CustomerProfile;
import com.amdevelopers.tms.entity.Invoice;
import com.amdevelopers.tms.entity.Order;
import com.amdevelopers.tms.entity.PaymentVerification;
import com.amdevelopers.tms.entity.User;
import com.amdevelopers.tms.enums.InvoiceStatus;
import com.amdevelopers.tms.enums.VerificationStatus;
import com.amdevelopers.tms.exceptions.ConflictException;
import com.amdevelopers.tms.exceptions.ResourceNotFoundException;
import com.amdevelopers.tms.repositories.InvoiceRepository;
import com.amdevelopers.tms.repositories.PaymentVerificationRepository;
import java.time.LocalDateTime;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

/**
 * Payment-proof verification: a customer who has paid an issued invoice uploads
 * a screenshot and a message, and a cashier/admin reviews the evidence and
 * either approves it (which records the payment through the shared invoice
 * settlement) or rejects it with a note the customer can read and resubmit
 * against.
 *
 * <p>Approval deliberately delegates the actual money step to
 * {@link InvoiceService#recordPayment(Long)} so this workflow reuses the exact
 * settlement guards and side effects (invoice PAID, paidAt stamped, order
 * released to the tailor). At most one {@code PENDING} proof may exist per
 * invoice, and only the owning customer can submit or read their proofs.
 */
@Service
@RequiredArgsConstructor
public class PaymentVerificationService {

    private final PaymentVerificationRepository verificationRepository;
    private final InvoiceRepository invoiceRepository;
    private final FileStorageService fileStorageService;
    private final InvoiceService invoiceService;
    private final UserService userService;

    /**
     * Records a customer's payment proof (screenshot + message) against an
     * issued or overdue invoice they own. Rejects invoices that are already
     * paid, still drafts or not yet billable, and refuses to stack a second
     * proof while one is already awaiting review.
     */
    @Transactional
    public PaymentVerificationDTO submit(SubmitPaymentProofDTO dto) {
        Invoice invoice = requireInvoice(dto.getInvoiceId());
        User currentUser = userService.getCurrentUser();
        requireOwner(invoice, currentUser);

        InvoiceStatus status = invoice.getStatus();
        if (status != InvoiceStatus.ISSUED && status != InvoiceStatus.OVERDUE) {
            throw new IllegalStateException(
                    "Proof can only be submitted for issued or overdue invoices, current status: " + status);
        }
        if (verificationRepository.existsByInvoiceAndStatus(invoice, VerificationStatus.PENDING)) {
            throw new ConflictException(
                    "A payment proof for invoice " + invoice.getInvoiceNumber()
                            + " is already awaiting verification");
        }

        MultipartFile screenshot = dto.getScreenshot();
        if (screenshot == null || screenshot.isEmpty()) {
            throw new IllegalArgumentException("Please attach a screenshot of the payment as proof");
        }
        String message = dto.getMessage() == null ? null : dto.getMessage().trim();
        if (message == null || message.isEmpty()) {
            throw new IllegalArgumentException("Please describe how you made the payment");
        }

        PaymentVerification verification = PaymentVerification.builder()
                .invoice(invoice)
                .submittedBy(currentUser)
                .message(message)
                .screenshotUrl(fileStorageService.store(screenshot))
                .screenshotName(screenshot.getOriginalFilename())
                .screenshotType(screenshot.getContentType())
                .status(VerificationStatus.PENDING)
                .submittedAt(LocalDateTime.now())
                .build();
        return PaymentVerificationDTO.from(verificationRepository.save(verification));
    }

    /** Pending proofs (or another status when requested) for the review queue. */
    @Transactional(readOnly = true)
    public List<PaymentVerificationDTO> listForStaff(VerificationStatus status) {
        VerificationStatus filter = status == null ? VerificationStatus.PENDING : status;
        return verificationRepository.findAllByStatusOrderBySubmittedAtDesc(filter)
                .stream()
                .map(PaymentVerificationDTO::from)
                .toList();
    }

    /**
     * A customer's own proof history for one of their invoices, newest first,
     * so they can see whether their submission is pending, was approved or was
     * rejected (and why).
     */
    @Transactional(readOnly = true)
    public List<PaymentVerificationDTO> listForCustomer(Long invoiceId) {
        Invoice invoice = requireInvoice(invoiceId);
        requireOwner(invoice, userService.getCurrentUser());
        return verificationRepository.findAllByInvoiceOrderBySubmittedAtDesc(invoice)
                .stream()
                .map(PaymentVerificationDTO::from)
                .toList();
    }

    /**
     * Approves a pending proof: records the payment on the invoice and order
     * (unless the cashier already did so directly) and marks the proof
     * {@code APPROVED} with the reviewer and note.
     */
    @Transactional
    public PaymentVerificationDTO approve(Long verificationId, String note) {
        PaymentVerification verification = requireVerification(verificationId);
        requirePending(verification);

        Invoice invoice = verification.getInvoice();
        // If the cashier settled the invoice manually while the proof sat
        // pending, there is nothing left to pay — just approve the proof.
        if (invoice.getStatus() != InvoiceStatus.PAID) {
            invoiceService.recordPayment(invoice.getId());
        }

        verification.setStatus(VerificationStatus.APPROVED);
        verification.setReviewedBy(userService.getCurrentUser());
        verification.setReviewedAt(LocalDateTime.now());
        verification.setReviewNote(trimToNull(note));
        return PaymentVerificationDTO.from(verification);
    }

    /**
     * Rejects a pending proof. A note is mandatory — it is the reason shown to
     * the customer, who may resubmit better evidence afterwards.
     */
    @Transactional
    public PaymentVerificationDTO reject(Long verificationId, String note) {
        PaymentVerification verification = requireVerification(verificationId);
        requirePending(verification);

        String reason = trimToNull(note);
        if (reason == null) {
            throw new IllegalArgumentException("A reason is required to reject a payment proof");
        }

        verification.setStatus(VerificationStatus.REJECTED);
        verification.setReviewedBy(userService.getCurrentUser());
        verification.setReviewedAt(LocalDateTime.now());
        verification.setReviewNote(reason);
        return PaymentVerificationDTO.from(verification);
    }

    // ---------------- Internals ----------------

    private Invoice requireInvoice(Long invoiceId) {
        return invoiceRepository.findById(invoiceId)
                .orElseThrow(() -> new ResourceNotFoundException("Invoice not found: " + invoiceId));
    }

    private PaymentVerification requireVerification(Long verificationId) {
        return verificationRepository.findById(verificationId)
                .orElseThrow(() -> new ResourceNotFoundException("Payment proof not found: " + verificationId));
    }

    private static void requirePending(PaymentVerification verification) {
        if (verification.getStatus() != VerificationStatus.PENDING) {
            throw new IllegalStateException(
                    "This payment proof has already been " + verification.getStatus().name().toLowerCase());
        }
    }

    /** The current user must be the customer who owns the invoice's order. */
    private static void requireOwner(Invoice invoice, User currentUser) {
        Order order = invoice.getOrder();
        CustomerProfile customer = order != null ? order.getCustomer() : null;
        if (customer == null || customer.getUser() == null
                || !customer.getUser().getId().equals(currentUser.getId())) {
            throw new AccessDeniedException("You can only submit proof for your own invoices");
        }
    }

    private static String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
