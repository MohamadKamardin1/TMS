package com.amdevelopers.tms.dto;

import com.amdevelopers.tms.entity.CustomerProfile;
import com.amdevelopers.tms.entity.Invoice;
import com.amdevelopers.tms.entity.Order;
import com.amdevelopers.tms.entity.PaymentVerification;
import com.amdevelopers.tms.enums.InvoiceStatus;
import com.amdevelopers.tms.enums.VerificationStatus;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Read model of a payment proof for the cashier's review queue and the
 * customer's invoice view. Carries a compact invoice/order summary so the
 * review queue is self-contained: who owes, how much, what the proof says and
 * a thumbnail of the uploaded screenshot.
 *
 * @param id               verification id
 * @param invoiceId        invoice under review
 * @param invoiceNumber    human-readable invoice number (INV-2026-0001)
 * @param invoiceStatus    the invoice's own status when the proof was read
 * @param orderId          linked order
 * @param orderTitle       order display title / garment
 * @param customerName     display name of the customer who submitted the proof
 * @param submittedByName  display name of the account that submitted it
 * @param message          customer's payment description / reference
 * @param screenshotUrl    public URL of the screenshot
 * @param screenshotName   original file name of the screenshot
 * @param screenshotType   content type of the screenshot
 * @param totalAmount      invoice grand total this proof is meant to settle
 * @param dueDate          invoice due date
 * @param status           verification status (PENDING / APPROVED / REJECTED)
 * @param reviewNote       cashier's note (reason shown on rejection)
 * @param reviewedBy       cashier/admin who reviewed it
 * @param submittedAt      when the customer submitted the proof
 * @param reviewedAt       when the cashier acted on it
 */
public record PaymentVerificationDTO(
        Long id,
        Long invoiceId,
        String invoiceNumber,
        InvoiceStatus invoiceStatus,
        Long orderId,
        String orderTitle,
        String customerName,
        String submittedByName,
        String message,
        String screenshotUrl,
        String screenshotName,
        String screenshotType,
        BigDecimal totalAmount,
        LocalDate dueDate,
        VerificationStatus status,
        String reviewNote,
        String reviewedBy,
        LocalDateTime submittedAt,
        LocalDateTime reviewedAt) {

    /**
     * Maps a {@link PaymentVerification}. Must be called inside a transaction
     * because the invoice, its order and the users are lazily fetched.
     */
    public static PaymentVerificationDTO from(PaymentVerification verification) {
        Invoice invoice = verification.getInvoice();
        Order order = invoice != null ? invoice.getOrder() : null;
        CustomerProfile customer = order != null ? order.getCustomer() : null;
        String customerName = customer != null && customer.getUser() != null
                ? customer.getUser().getFullName()
                : null;
        String orderTitle = order != null
                ? order.getTitle() != null ? order.getTitle()
                        : order.getGarmentType() != null ? order.getGarmentType()
                                : "Tailoring request"
                : null;

        return new PaymentVerificationDTO(
                verification.getId(),
                invoice != null ? invoice.getId() : null,
                invoice != null ? invoice.getInvoiceNumber() : null,
                invoice != null ? invoice.getStatus() : null,
                order != null ? order.getId() : null,
                orderTitle,
                customerName,
                verification.getSubmittedBy() != null ? verification.getSubmittedBy().getFullName() : null,
                verification.getMessage(),
                verification.getScreenshotUrl(),
                verification.getScreenshotName(),
                verification.getScreenshotType(),
                invoice != null ? invoice.getTotalAmount() : null,
                invoice != null ? invoice.getDueDate() : null,
                verification.getStatus(),
                verification.getReviewNote(),
                verification.getReviewedBy() != null ? verification.getReviewedBy().getFullName() : null,
                verification.getSubmittedAt(),
                verification.getReviewedAt());
    }
}
