package com.amdevelopers.tms.dto;

import com.amdevelopers.tms.entity.CustomerProfile;
import com.amdevelopers.tms.entity.Invoice;
import com.amdevelopers.tms.entity.Order;
import com.amdevelopers.tms.enums.InvoiceStatus;
import com.amdevelopers.tms.enums.OrderStatus;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * Read model of an invoice for the billing dashboards and the customer's
 * invoice view. It carries a compact order summary (number, title, customer,
 * garment) so a row in the cashier table is self-contained without a second
 * request per invoice.
 *
 * @param id                     invoice id
 * @param invoiceNumber          human-readable document number (INV-2026-0001)
 * @param orderId                linked order
 * @param orderTitle             order display title / garment
 * @param customerName           customer display name
 * @param orderStatus            the order's current lifecycle status
 * @param subtotal               base amount
 * @param taxAmount              tax charged
 * @param discountAmount         discount granted
 * @param totalAmount            final amount payable (computed server-side)
 * @param paymentInstructions    bank / payment details shown to the customer
 * @param dueDate                payment deadline
 * @param status                 invoice status
 * @param issuedBy               full name of the cashier/admin who issued it
 * @param issuedAt               when the invoice was issued (finalised)
 * @param paidAt                 when payment was recorded, null until paid
 * @param createdAt              when the draft was first created
 */
public record InvoiceDTO(
        Long id,
        String invoiceNumber,
        Long orderId,
        String orderTitle,
        String customerName,
        OrderStatus orderStatus,
        BigDecimal subtotal,
        BigDecimal taxAmount,
        BigDecimal discountAmount,
        BigDecimal totalAmount,
        String paymentInstructions,
        LocalDate dueDate,
        InvoiceStatus status,
        String issuedBy,
        LocalDateTime issuedAt,
        LocalDateTime paidAt,
        LocalDateTime createdAt) {

    /**
     * Maps an {@link Invoice}. Must be called inside a transaction because the
     * order and its customer are lazily fetched.
     */
    public static InvoiceDTO from(Invoice invoice) {
        Order order = invoice.getOrder();
        CustomerProfile customer = order != null ? order.getCustomer() : null;
        String customerName = customer != null && customer.getUser() != null
                ? customer.getUser().getFullName()
                : null;
        String orderTitle = order != null
                ? order.getTitle() != null ? order.getTitle()
                        : order.getGarmentType() != null ? order.getGarmentType()
                                : "Tailoring request"
                : null;

        return new InvoiceDTO(
                invoice.getId(),
                invoice.getInvoiceNumber(),
                order != null ? order.getId() : null,
                orderTitle,
                customerName,
                order != null ? order.getStatus() : null,
                invoice.getSubtotal(),
                invoice.getTaxAmount(),
                invoice.getDiscountAmount(),
                invoice.getTotalAmount(),
                invoice.getPaymentInstructions(),
                invoice.getDueDate(),
                invoice.getStatus(),
                invoice.getIssuedBy() != null ? invoice.getIssuedBy().getFullName() : null,
                invoice.getIssuedAt(),
                invoice.getPaidAt(),
                invoice.getCreatedAt());
    }
}
