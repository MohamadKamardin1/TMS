package com.amdevelopers.tms.enums;

/**
 * Lifecycle of a customer-submitted payment proof.
 *
 * <p>A customer who has paid submits a screenshot and a message, creating a
 * {@code PENDING} verification for the cashier to review. Approving it records
 * the payment on the invoice/order; rejecting it returns it to the customer
 * with a {@code reviewNote} so they can resubmit better evidence. Only one
 * {@code PENDING} proof may exist per invoice at a time.
 */
public enum VerificationStatus {
    PENDING,
    APPROVED,
    REJECTED
}
