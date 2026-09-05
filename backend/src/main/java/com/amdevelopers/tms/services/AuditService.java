package com.amdevelopers.tms.services;

import com.amdevelopers.tms.entity.AuditLog;
import com.amdevelopers.tms.entity.Invoice;
import com.amdevelopers.tms.entity.Order;
import com.amdevelopers.tms.entity.User;
import com.amdevelopers.tms.repositories.AuditLogRepository;
import com.amdevelopers.tms.repositories.UserRepository;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Writes {@link AuditLog} entries. Every state-changing mutation in the order,
 * invoice and admin-user services routes through here so the organisation has a
 * complete, queryable history of <em>who changed what, from which value to which
 * value, and when</em>.
 *
 * <p>The before/after snapshots are produced by the {@code *State} helpers. All
 * values are reduced to JSON-safe scalars (strings, numbers, booleans) so a
 * snapshot can be stored and diffed without any serializer/type special cases.
 */
@Service
@RequiredArgsConstructor
public class AuditService {

    /** Canonical audit action codes. Kept as strings so new codes need no migration. */
    public static final class Actions {
        private Actions() {
        }

        public static final String ORDER_CREATED = "ORDER_CREATED";
        public static final String ORDER_TAILOR_ASSIGNED = "ORDER_TAILOR_ASSIGNED";
        public static final String ORDER_ESTIMATED = "ORDER_ESTIMATED";
        public static final String ORDER_DELIVERY_ASSIGNED = "ORDER_DELIVERY_ASSIGNED";
        public static final String ORDER_STATUS_CHANGED = "ORDER_STATUS_CHANGED";

        public static final String INVOICE_GENERATED = "INVOICE_GENERATED";
        public static final String INVOICE_UPDATED = "INVOICE_UPDATED";
        public static final String INVOICE_ISSUED = "INVOICE_ISSUED";
        public static final String INVOICE_PAID = "INVOICE_PAID";
        public static final String INVOICE_DISCARDED = "INVOICE_DISCARDED";
        public static final String INVOICE_MARKED_OVERDUE = "INVOICE_MARKED_OVERDUE";

        public static final String USER_ROLE_CHANGED = "USER_ROLE_CHANGED";
        public static final String USER_STATUS_CHANGED = "USER_STATUS_CHANGED";
        public static final String USER_PASSWORD_RESET = "USER_PASSWORD_RESET";
    }

    /** Canonical entity type labels used for {@code entity_type}. */
    public static final String ENTITY_ORDER = "ORDER";
    public static final String ENTITY_INVOICE = "INVOICE";
    public static final String ENTITY_USER = "USER";

    private final AuditLogRepository auditLogRepository;
    private final UserRepository userRepository;

    /**
     * Records an action attributed to the currently authenticated user.
     */
    @Transactional
    public void record(String action, String entityType, Long entityId,
                       Map<String, Object> oldValues, Map<String, Object> newValues) {
        auditLogRepository.save(AuditLog.builder()
                .actorId(resolveCurrentActorId())
                .action(action)
                .entityType(entityType)
                .entityId(entityId)
                .oldValues(emptyToNull(oldValues))
                .newValues(emptyToNull(newValues))
                .timestamp(java.time.LocalDateTime.now())
                .build());
    }

    /**
     * Records a system action with no human actor (used for automated status
     * promotion such as the overdue sweep).
     */
    @Transactional
    public void recordSystem(String action, String entityType, Long entityId,
                             Map<String, Object> oldValues, Map<String, Object> newValues) {
        auditLogRepository.save(AuditLog.builder()
                .actorId(null)
                .action(action)
                .entityType(entityType)
                .entityId(entityId)
                .oldValues(emptyToNull(oldValues))
                .newValues(emptyToNull(newValues))
                .timestamp(java.time.LocalDateTime.now())
                .build());
    }

    // ---------------- Snapshot helpers ----------------

    /**
     * JSON-safe snapshot of an order's stateful fields. Must be called inside a
     * transaction because the tailor/delivery agents are lazily loaded.
     */
    public static Map<String, Object> orderState(Order order) {
        Map<String, Object> state = new LinkedHashMap<>();
        state.put("status", order.getStatus() == null ? null : order.getStatus().name());
        state.put("title", order.getTitle());
        state.put("garmentType", order.getGarmentType());
        state.put("tailor", nameOf(order.getTailor()));
        state.put("deliveryAgent", nameOf(order.getDeliveryAgent()));
        state.put("estimatedPrice", plain(order.getEstimatedPrice()));
        state.put("estimatedCompletionDate", text(order.getEstimatedCompletionDate()));
        return state;
    }

    /** JSON-safe snapshot of an invoice's financial/status fields. */
    public static Map<String, Object> invoiceState(Invoice invoice) {
        Map<String, Object> state = new LinkedHashMap<>();
        state.put("invoiceNumber", invoice.getInvoiceNumber());
        state.put("status", invoice.getStatus() == null ? null : invoice.getStatus().name());
        state.put("subtotal", plain(invoice.getSubtotal()));
        state.put("taxAmount", plain(invoice.getTaxAmount()));
        state.put("discountAmount", plain(invoice.getDiscountAmount()));
        state.put("totalAmount", plain(invoice.getTotalAmount()));
        state.put("dueDate", text(invoice.getDueDate()));
        return state;
    }

    /** JSON-safe snapshot of a user's role/status fields (never the password). */
    public static Map<String, Object> userState(User user) {
        Map<String, Object> state = new LinkedHashMap<>();
        state.put("username", user.getUsername());
        state.put("fullName", user.getFullName());
        state.put("email", user.getEmail());
        state.put("role", user.getRole() == null ? null : user.getRole().name());
        state.put("active", Boolean.TRUE.equals(user.getIsActive()));
        return state;
    }

    private static String nameOf(User user) {
        if (user == null) {
            return null;
        }
        return user.getFullName() != null ? user.getFullName() : user.getUsername();
    }

    /** Renders a money value to two decimals without scientific notation (e.g. "2000.00"). */
    private static String plain(BigDecimal value) {
        if (value == null) {
            return null;
        }
        return value.setScale(2, java.math.RoundingMode.HALF_UP).toPlainString();
    }

    private static String text(LocalDate date) {
        return date == null ? null : date.toString();
    }

    private static Map<String, Object> emptyToNull(Map<String, Object> values) {
        return values == null || values.isEmpty() ? null : values;
    }

    /**
     * Maps the authenticated principal (its name is the username) to a numeric
     * user id. Returns {@code null} when no authentication is present, which is
     * expected for system-driven actions.
     */
    private Long resolveCurrentActorId() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()
                || !(authentication.getPrincipal() instanceof org.springframework.security.core.userdetails.UserDetails)) {
            return null;
        }
        String username = authentication.getName();
        return userRepository.findByUsername(username).map(User::getId).orElse(null);
    }
}
