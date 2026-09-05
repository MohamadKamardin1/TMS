package com.amdevelopers.tms.enums;

/**
 * Lifecycle of an invoice as a financial document.
 *
 * <p>{@code DRAFT} invoices are being prepared by the cashier and are not yet
 * visible/payable to the customer. Issuing turns a draft into a real document
 * ({@code ISSUED}). Once the due date passes unpaid, a lazy sweep promotes the
 * invoice to {@code OVERDUE}. {@code PAID} closes the invoice and unlocks
 * production for the linked order. {@code CANCELLED} marks a voided document.
 */
public enum InvoiceStatus {
    DRAFT,
    ISSUED,
    PAID,
    OVERDUE,
    CANCELLED
}
