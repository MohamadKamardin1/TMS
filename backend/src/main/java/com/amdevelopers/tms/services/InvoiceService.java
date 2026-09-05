package com.amdevelopers.tms.services;

import com.amdevelopers.tms.dto.GenerateInvoiceDTO;
import com.amdevelopers.tms.dto.InvoiceDTO;
import com.amdevelopers.tms.dto.UpdatePaymentStatusDTO;
import com.amdevelopers.tms.entity.Invoice;
import com.amdevelopers.tms.entity.Order;
import com.amdevelopers.tms.entity.User;
import com.amdevelopers.tms.enums.OrderStatus;
import com.amdevelopers.tms.enums.PaymentStatus;
import com.amdevelopers.tms.exceptions.ResourceNotFoundException;
import com.amdevelopers.tms.repositories.InvoiceRepository;
import com.amdevelopers.tms.repositories.OrderRepository;
import java.time.LocalDateTime;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Invoice lifecycle. Enforces the strict state machine
 * {@code ESTIMATED -> INVOICED -> PAID} on the order, and
 * {@code PENDING -> PAID | FAILED} on the invoice.
 */
@Service
@RequiredArgsConstructor
public class InvoiceService {

    private final InvoiceRepository invoiceRepository;
    private final OrderRepository orderRepository;
    private final UserService userService;

    @Transactional
    public InvoiceDTO generateInvoice(Long orderId, GenerateInvoiceDTO dto) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new ResourceNotFoundException("Order not found: " + orderId));

        invoiceRepository.findByOrder(order).ifPresent(invoice -> {
            throw new IllegalStateException("Order " + orderId + " already has an invoice");
        });

        if (order.getStatus() != OrderStatus.ESTIMATED) {
            throw new IllegalStateException(
                    "Invoice can only be generated for orders in ESTIMATED status, current: " + order.getStatus());
        }

        User cashier = userService.getCurrentUser();
        Invoice invoice = Invoice.builder()
                .order(order)
                .amount(dto.amount())
                .accountNumber(dto.accountNumber())
                .referenceNumber(dto.referenceNumber())
                .paymentStatus(PaymentStatus.PENDING)
                .issuedBy(cashier)
                .issuedAt(LocalDateTime.now())
                .build();
        invoiceRepository.save(invoice);

        order.setStatus(OrderStatus.INVOICED);
        return InvoiceDTO.from(invoice);
    }

    /**
     * Applies a payment status transition to an invoice. Only PAID advances
     * the workflow (order -> PAID, {@code paidAt} stamped). FAILED records a
     * failed payment and leaves the order in INVOICED so it can be retried.
     */
    @Transactional
    public InvoiceDTO markAsPaid(Long invoiceId, UpdatePaymentStatusDTO dto) {
        Invoice invoice = invoiceRepository.findById(invoiceId)
                .orElseThrow(() -> new ResourceNotFoundException("Invoice not found: " + invoiceId));
        Order order = invoice.getOrder();

        if (order.getStatus() != OrderStatus.INVOICED) {
            throw new IllegalStateException(
                    "Order must be INVOICED before its payment status can change, current: " + order.getStatus());
        }

        switch (dto.paymentStatus()) {
            case PAID -> {
                invoice.setPaymentStatus(PaymentStatus.PAID);
                invoice.setPaidAt(LocalDateTime.now());
                order.setStatus(OrderStatus.PAID);
            }
            case FAILED -> invoice.setPaymentStatus(PaymentStatus.FAILED);
            case PENDING -> throw new IllegalArgumentException(
                    "Invoice is already pending; only PAID or FAILED updates are allowed");
        }
        return InvoiceDTO.from(invoice);
    }

    @Transactional(readOnly = true)
    public InvoiceDTO getInvoiceByOrder(Long orderId) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new ResourceNotFoundException("Order not found: " + orderId));
        Invoice invoice = invoiceRepository.findByOrder(order)
                .orElseThrow(() -> new ResourceNotFoundException("No invoice found for order: " + orderId));
        return InvoiceDTO.from(invoice);
    }

    /**
     * Customer-facing invoice lookup: the authenticated user must own the order
     * the invoice belongs to.
     */
    @Transactional(readOnly = true)
    public InvoiceDTO getInvoiceForCustomer(Long orderId) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new ResourceNotFoundException("Order not found: " + orderId));
        User currentUser = userService.getCurrentUser();
        if (order.getCustomer() == null || order.getCustomer().getUser() == null
                || !order.getCustomer().getUser().getId().equals(currentUser.getId())) {
            throw new AccessDeniedException("You cannot view this invoice");
        }
        return getInvoiceByOrder(orderId);
    }
}