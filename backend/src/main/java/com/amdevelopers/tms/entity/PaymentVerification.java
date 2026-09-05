package com.amdevelopers.tms.entity;

import com.amdevelopers.tms.enums.VerificationStatus;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * A customer-submitted proof of payment for an issued invoice, e.g. a bank
 * transfer screenshot plus a short message describing how the money was sent.
 *
 * <p>An invoice may accumulate several verifications over time (a rejected one
 * followed by a resubmission), but at most one may be {@code PENDING} at any
 * moment. When the cashier approves a proof the invoice and its order move to
 * {@code PAID}; a rejection keeps them payable so the customer can resubmit.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@Entity
@Table(name = "payment_verifications")
public class PaymentVerification {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "invoice_id", nullable = false)
    private Invoice invoice;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "submitted_by", nullable = false)
    private User submittedBy;

    /** Short message from the customer, e.g. payment method and reference. */
    @Column(name = "message", columnDefinition = "TEXT")
    private String message;

    /** Public URL of the uploaded screenshot (served under /uploads/**). */
    @Column(name = "screenshot_url", nullable = false, length = 255)
    private String screenshotUrl;

    @Column(name = "screenshot_name", nullable = false, length = 255)
    private String screenshotName;

    @Column(name = "screenshot_type", length = 100)
    private String screenshotType;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    @Builder.Default
    private VerificationStatus status = VerificationStatus.PENDING;

    /** Cashier's verdict note shown to the customer when rejected. */
    @Column(name = "review_note", columnDefinition = "TEXT")
    private String reviewNote;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "reviewed_by")
    private User reviewedBy;

    @Column(name = "reviewed_at")
    private LocalDateTime reviewedAt;

    @Column(name = "submitted_at", updatable = false)
    private LocalDateTime submittedAt;
}
