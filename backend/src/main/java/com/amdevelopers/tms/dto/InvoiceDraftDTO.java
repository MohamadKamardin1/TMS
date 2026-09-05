package com.amdevelopers.tms.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * Amounts and terms a cashier sets on an invoice while it is being prepared.
 *
 * <p>The same record drives both creation and later edits of a draft. Every
 * field is optional so a partial update can touch only what changed: {@code null}
 * means "derive from the order estimate" (on create) or "leave unchanged" (on
 * update). All monetary validation and the grand-total calculation happen on the
 * backend, never in the client.
 *
 * @param subtotal           base price of the tailoring work (defaults to the order's estimated price)
 * @param taxAmount          additional tax charged (defaults to zero)
 * @param discountAmount     discount granted to the customer (defaults to zero)
 * @param paymentInstructions how/where to pay (bank details, account number, etc.)
 * @param dueDate            deadline for the customer to pay (defaults to 7 days out)
 */
public record InvoiceDraftDTO(
        @DecimalMin(value = "0.00", message = "Subtotal cannot be negative")
        BigDecimal subtotal,

        @PositiveOrZero(message = "Tax cannot be negative")
        BigDecimal taxAmount,

        @PositiveOrZero(message = "Discount cannot be negative")
        BigDecimal discountAmount,

        @Size(max = 3000, message = "Payment instructions must be at most 3000 characters")
        String paymentInstructions,

        LocalDate dueDate) {
}
