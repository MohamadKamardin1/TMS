package com.amdevelopers.tms.dto;

import com.amdevelopers.tms.entity.Invoice;
import com.amdevelopers.tms.entity.Order;
import com.amdevelopers.tms.enums.OrderStatus;
import com.amdevelopers.tms.enums.PaymentStatus;
import java.math.BigDecimal;
import java.time.LocalDateTime;

public record InvoiceDTO(
        Long id,
        Long orderId,
        OrderStatus orderStatus,
        BigDecimal amount,
        String accountNumber,
        String referenceNumber,
        PaymentStatus paymentStatus,
        String issuedBy,
        LocalDateTime issuedAt,
        LocalDateTime paidAt) {

    /**
     * Must be called inside a transaction: the order is lazily fetched.
     */
    public static InvoiceDTO from(Invoice invoice) {
        Order order = invoice.getOrder();
        return new InvoiceDTO(
                invoice.getId(),
                order != null ? order.getId() : null,
                order != null ? order.getStatus() : null,
                invoice.getAmount(),
                invoice.getAccountNumber(),
                invoice.getReferenceNumber(),
                invoice.getPaymentStatus(),
                invoice.getIssuedBy() != null ? invoice.getIssuedBy().getFullName() : null,
                invoice.getIssuedAt(),
                invoice.getPaidAt());
    }
}