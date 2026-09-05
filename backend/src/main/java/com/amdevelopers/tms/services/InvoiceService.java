package com.amdevelopers.tms.services;

import com.amdevelopers.tms.dto.InvoiceDTO;
import com.amdevelopers.tms.dto.InvoiceDraftDTO;
import com.amdevelopers.tms.entity.Invoice;
import com.amdevelopers.tms.entity.Order;
import com.amdevelopers.tms.entity.User;
import com.amdevelopers.tms.enums.InvoiceStatus;
import com.amdevelopers.tms.enums.OrderStatus;
import com.amdevelopers.tms.exceptions.ResourceNotFoundException;
import com.amdevelopers.tms.repositories.InvoiceRepository;
import com.amdevelopers.tms.repositories.OrderRepository;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Invoice lifecycle as a real financial document.
 *
 * <p>Invoicing is deliberately two-phase: {@code generateInvoice} creates a
 * {@link InvoiceStatus#DRAFT} and moves the order to {@code INVOICED};
 * {@code updateInvoice} lets the cashier adjust amounts <em>before</em> the
 * document is finalised; {@code issueInvoice} turns the draft into a payable
 * document ({@code ISSUED}); {@code recordPayment} closes it as {@code PAID} and
 * releases the order to the tailor. Abandoned drafts can be discarded
 * ({@code discardDraft}), which returns the order to {@code ESTIMATED} so it can
 * be re-invoiced.
 *
 * <p>Every monetary value is validated and the grand total is always recomputed
 * here — never trusted from the client. Orders that were {@code ISSUED} but not
 * paid by {@code dueDate} are lazily promoted to {@code OVERDUE} on read.
 */
@Service
@RequiredArgsConstructor
public class InvoiceService {

    private static final int MONEY_SCALE = 2;

    private final InvoiceRepository invoiceRepository;
    private final OrderRepository orderRepository;
    private final UserService userService;
    private final AuditService auditService;

    /**
     * Creates a draft invoice for an ESTIMATED order, computes the totals and
     * moves the order to INVOICED. Rejects orders that already carry an invoice
     * (a draft may only be replaced by discarding it first).
     */
    @Transactional
    public InvoiceDTO generateInvoice(Long orderId, InvoiceDraftDTO dto) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new ResourceNotFoundException("Order not found: " + orderId));

        invoiceRepository.findByOrder(order).ifPresent(existing -> {
            throw new IllegalStateException(
                    "Order " + orderId + " already has an invoice (" + existing.getStatus() + "). "
                            + "Discard the existing draft before regenerating.");
        });

        if (order.getStatus() != OrderStatus.ESTIMATED) {
            throw new IllegalStateException(
                    "Invoice can only be generated for orders in ESTIMATED status, current: " + order.getStatus());
        }
        if (order.getEstimatedPrice() == null) {
            throw new IllegalStateException("Order " + orderId + " has no estimated price to invoice");
        }

        Invoice invoice = Invoice.builder()
                .order(order)
                .invoiceNumber(nextInvoiceNumber(LocalDate.now().getYear()))
                .status(InvoiceStatus.DRAFT)
                .createdAt(LocalDateTime.now())
                .build();
        applyDraftFields(invoice, dto, true);

        invoiceRepository.save(invoice);
        Map<String, Object> orderBefore = AuditService.orderState(order);
        order.setStatus(OrderStatus.INVOICED);
        auditService.record(AuditService.Actions.INVOICE_GENERATED, AuditService.ENTITY_INVOICE,
                invoice.getId(), null, AuditService.invoiceState(invoice));
        auditService.record(AuditService.Actions.ORDER_STATUS_CHANGED, AuditService.ENTITY_ORDER,
                order.getId(), orderBefore, AuditService.orderState(order));
        return InvoiceDTO.from(invoice);
    }

    /**
     * Adjusts the amounts/terms of an invoice while it is still a DRAFT (before
     * it has been finalised). An issued, paid or overdue document is immutable.
     */
    @Transactional
    public InvoiceDTO updateInvoice(Long invoiceId, InvoiceDraftDTO dto) {
        Invoice invoice = requireInvoice(invoiceId);
        requireDraft(invoice);
        Map<String, Object> before = AuditService.invoiceState(invoice);
        applyDraftFields(invoice, dto, false);
        auditService.record(AuditService.Actions.INVOICE_UPDATED, AuditService.ENTITY_INVOICE,
                invoice.getId(), before, AuditService.invoiceState(invoice));
        return InvoiceDTO.from(invoice);
    }

    /**
     * Finalises a draft into a payable document: DRAFT -&gt; ISSUED and stamps
     * the issue time. The linked order stays INVOICED (awaiting payment).
     */
    @Transactional
    public InvoiceDTO issueInvoice(Long invoiceId) {
        Invoice invoice = requireInvoice(invoiceId);
        requireDraft(invoice);
        Map<String, Object> before = AuditService.invoiceState(invoice);
        if (invoice.getDueDate() == null) {
            invoice.setDueDate(LocalDate.now().plusDays(7));
        }
        invoice.setStatus(InvoiceStatus.ISSUED);
        invoice.setIssuedAt(LocalDateTime.now());
        invoice.setIssuedBy(userService.getCurrentUser());
        auditService.record(AuditService.Actions.INVOICE_ISSUED, AuditService.ENTITY_INVOICE,
                invoice.getId(), before, AuditService.invoiceState(invoice));
        return InvoiceDTO.from(invoice);
    }

    /**
     * Confirms receipt of payment: the invoice becomes PAID (paidAt stamped)
     * and the linked order is automatically moved to PAID, triggering the
     * tailor to start production.
     */
    @Transactional
    public InvoiceDTO recordPayment(Long invoiceId) {
        Invoice invoice = requireInvoice(invoiceId);
        InvoiceStatus status = invoice.getStatus();
        if (status != InvoiceStatus.ISSUED && status != InvoiceStatus.OVERDUE) {
            throw new IllegalStateException(
                    "Only issued or overdue invoices can be paid, current status: " + status);
        }

        Order order = invoice.getOrder();
        if (order.getStatus() != OrderStatus.INVOICED) {
            throw new IllegalStateException(
                    "Order must be INVOICED before payment can be recorded, current: " + order.getStatus());
        }

        Map<String, Object> invoiceBefore = AuditService.invoiceState(invoice);
        Map<String, Object> orderBefore = AuditService.orderState(order);
        invoice.setStatus(InvoiceStatus.PAID);
        invoice.setPaidAt(LocalDateTime.now());
        order.setStatus(OrderStatus.PAID);
        auditService.record(AuditService.Actions.INVOICE_PAID, AuditService.ENTITY_INVOICE,
                invoice.getId(), invoiceBefore, AuditService.invoiceState(invoice));
        auditService.record(AuditService.Actions.ORDER_STATUS_CHANGED, AuditService.ENTITY_ORDER,
                order.getId(), orderBefore, AuditService.orderState(order));
        return InvoiceDTO.from(invoice);
    }

    /**
     * Removes an abandoned DRAFT and returns the order to ESTIMATED so the
     * cashier can start over. Drafts carry no legal standing, so discarding them
     * simply releases the order back to the awaiting-invoice queue.
     */
    @Transactional
    public void discardDraft(Long invoiceId) {
        Invoice invoice = requireInvoice(invoiceId);
        requireDraft(invoice);

        Order order = invoice.getOrder();
        Map<String, Object> invoiceBefore = AuditService.invoiceState(invoice);
        Map<String, Object> orderBefore = AuditService.orderState(order);
        boolean orderWasInvoiced = order.getStatus() == OrderStatus.INVOICED;

        if (orderWasInvoiced) {
            order.setStatus(OrderStatus.ESTIMATED);
        }
        // Sever the managed inverse side first: Order.invoice carries
        // cascade = ALL, so a live back-reference would re-persist the removed
        // draft on flush.
        order.setInvoice(null);
        invoiceRepository.delete(invoice);
        invoiceRepository.flush();

        auditService.record(AuditService.Actions.INVOICE_DISCARDED, AuditService.ENTITY_INVOICE,
                invoiceId, invoiceBefore, null);
        if (orderWasInvoiced) {
            auditService.record(AuditService.Actions.ORDER_STATUS_CHANGED, AuditService.ENTITY_ORDER,
                    order.getId(), orderBefore, AuditService.orderState(order));
        }
    }

    // ---------------- Lookups ----------------

    /**
     * All invoices for staff dashboards, optionally narrowed by status. Runs the
     * overdue sweep first so EXPIRED issued invoices are reported as OVERDUE.
     */
    @Transactional
    public List<InvoiceDTO> getInvoicesByStatus(InvoiceStatus status) {
        markOverdueInvoices();
        List<Invoice> invoices = status == null
                ? invoiceRepository.findAllByOrderByCreatedAtDesc()
                : invoiceRepository.findAllByStatusOrderByCreatedAtDesc(status);
        return invoices.stream().map(InvoiceDTO::from).toList();
    }

    /** Single-invoice lookup for staff. */
    @Transactional
    public InvoiceDTO getInvoice(Long invoiceId) {
        markOverdueInvoices();
        return InvoiceDTO.from(requireInvoice(invoiceId));
    }

    @Transactional
    public InvoiceDTO getInvoiceByOrder(Long orderId) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new ResourceNotFoundException("Order not found: " + orderId));
        markOverdueInvoices();
        Invoice invoice = invoiceRepository.findByOrder(order)
                .orElseThrow(() -> new ResourceNotFoundException("No invoice found for order: " + orderId));
        return InvoiceDTO.from(invoice);
    }

    /**
     * Customer-facing lookup: the authenticated user must own the order the
     * invoice belongs to.
     */
    @Transactional
    public InvoiceDTO getInvoiceForCustomer(Long orderId) {
        Order order = orderRepository.findById(orderId)
                .orElseThrow(() -> new ResourceNotFoundException("Order not found: " + orderId));
        User currentUser = userService.getCurrentUser();
        if (order.getCustomer() == null || order.getCustomer().getUser() == null
                || !order.getCustomer().getUser().getId().equals(currentUser.getId())) {
            throw new AccessDeniedException("You cannot view this invoice");
        }
        markOverdueInvoices();
        Invoice invoice = invoiceRepository.findByOrder(order)
                .orElseThrow(() -> new ResourceNotFoundException("No invoice found for order: " + orderId));
        return InvoiceDTO.from(invoice);
    }

    // ---------------- Internals ----------------

    /**
     * Applies the cashier-supplied draft fields to an invoice and recomputes the
     * grand total. {@code isNew} selects the defaults for omitted fields:
     * {@code subtotal} falls back to the order estimate and {@code dueDate} to
     * seven days out on create; on update an omitted field leaves the value
     * unchanged. Explicitly sending {@code null}/{@code ""} still clears the
     * corresponding field.
     */
    private void applyDraftFields(Invoice invoice, InvoiceDraftDTO dto, boolean isNew) {
        Order order = invoice.getOrder();
        BigDecimal orderEstimate = order != null && order.getEstimatedPrice() != null
                ? order.getEstimatedPrice() : BigDecimal.ZERO;

        BigDecimal subtotal = firstNonNull(norm(dto.subtotal()),
                norm(invoice.getSubtotal()), isNew ? norm(orderEstimate) : null);
        BigDecimal tax = firstNonNull(norm(dto.taxAmount()),
                norm(invoice.getTaxAmount()), isNew ? BigDecimal.ZERO : null);
        BigDecimal discount = firstNonNull(norm(dto.discountAmount()),
                norm(invoice.getDiscountAmount()), isNew ? BigDecimal.ZERO : null);

        if (subtotal == null || subtotal.signum() < 0) {
            throw new IllegalArgumentException("Subtotal must be zero or positive");
        }
        if (tax != null && tax.signum() < 0) {
            throw new IllegalArgumentException("Tax cannot be negative");
        }
        if (discount != null && discount.signum() < 0) {
            throw new IllegalArgumentException("Discount cannot be negative");
        }
        if (discount != null && subtotal != null
                && discount.compareTo(subtotal.add(tax == null ? BigDecimal.ZERO : tax)) > 0) {
            throw new IllegalArgumentException("Discount cannot exceed the subtotal plus tax");
        }

        BigDecimal total = subtotal
                .add(tax == null ? BigDecimal.ZERO : tax)
                .subtract(discount == null ? BigDecimal.ZERO : discount);

        invoice.setSubtotal(subtotal);
        invoice.setTaxAmount(tax);
        invoice.setDiscountAmount(discount);
        invoice.setTotalAmount(total.setScale(MONEY_SCALE, RoundingMode.HALF_UP));

        String instructions = trimToNull(dto.paymentInstructions());
        if (instructions != null || isNew || dto.paymentInstructions() != null) {
            invoice.setPaymentInstructions(instructions);
        }

        if (dto.dueDate() != null) {
            invoice.setDueDate(dto.dueDate());
        } else if (invoice.getDueDate() == null && isNew) {
            invoice.setDueDate(LocalDate.now().plusDays(7));
        }
    }

    /**
     * Promotes issued invoices whose due date has passed to OVERDUE. Called at
     * the start of every read so stale "issued" rows never reach the UI.
     */
    private void markOverdueInvoices() {
        LocalDate today = LocalDate.now();
        for (Invoice invoice : invoiceRepository.findAllByStatus(InvoiceStatus.ISSUED)) {
            if (invoice.getDueDate() != null && invoice.getDueDate().isBefore(today)) {
                Map<String, Object> before = AuditService.invoiceState(invoice);
                invoice.setStatus(InvoiceStatus.OVERDUE);
                auditService.recordSystem(AuditService.Actions.INVOICE_MARKED_OVERDUE,
                        AuditService.ENTITY_INVOICE, invoice.getId(), before,
                        AuditService.invoiceState(invoice));
            }
        }
    }

    /**
     * Builds the next document number for a year, e.g. {@code INV-2026-0001}.
     * Numbering is per calendar year and restarts each year.
     */
    private String nextInvoiceNumber(int year) {
        String prefix = "INV-" + year + "-";
        long sequence = invoiceRepository.countByInvoiceNumberStartingWith(prefix) + 1;
        return String.format("%s%04d", prefix, sequence);
    }

    private Invoice requireInvoice(Long invoiceId) {
        return invoiceRepository.findById(invoiceId)
                .orElseThrow(() -> new ResourceNotFoundException("Invoice not found: " + invoiceId));
    }

    private static void requireDraft(Invoice invoice) {
        if (invoice.getStatus() != InvoiceStatus.DRAFT) {
            throw new IllegalStateException(
                    "Invoice " + invoice.getInvoiceNumber() + " is " + invoice.getStatus()
                            + " and can no longer be edited; only drafts can be changed");
        }
    }

    private static BigDecimal norm(BigDecimal value) {
        if (value == null) {
            return null;
        }
        return value.setScale(MONEY_SCALE, RoundingMode.HALF_UP);
    }

    /** First non-null of the given values. */
    private static BigDecimal firstNonNull(BigDecimal... values) {
        for (BigDecimal value : values) {
            if (value != null) {
                return value;
            }
        }
        return null;
    }

    private static String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
