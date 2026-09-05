package com.amdevelopers.tms.services;

import com.amdevelopers.tms.dto.AssignDeliveryRequest;
import com.amdevelopers.tms.dto.AssignTailorRequest;
import com.amdevelopers.tms.dto.CreateOrderDTO;
import com.amdevelopers.tms.dto.OrderDTO;
import com.amdevelopers.tms.dto.TailorEstimationDTO;
import com.amdevelopers.tms.dto.UpdateOrderStatusDTO;
import com.amdevelopers.tms.entity.CustomerProfile;
import com.amdevelopers.tms.entity.Order;
import com.amdevelopers.tms.entity.OrderAttachment;
import com.amdevelopers.tms.entity.User;
import com.amdevelopers.tms.entity.converter.JsonMapConverter;
import com.amdevelopers.tms.enums.OrderStatus;
import com.amdevelopers.tms.enums.Role;
import com.amdevelopers.tms.exceptions.ResourceNotFoundException;
import com.amdevelopers.tms.repositories.OrderRepository;
import com.amdevelopers.tms.repositories.UserRepository;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

@Service
@RequiredArgsConstructor
public class OrderService {

    private static final Sort CREATED_AT_DESC = Sort.by(Sort.Direction.DESC, "createdAt");

    /**
     * The complete order state machine. Each entry lists the statuses an order
     * may legally move to. Everything not listed here is rejected by
     * {@link #validateTransition} with a 409.
     */
    private static final Map<OrderStatus, Set<OrderStatus>> ALLOWED_TRANSITIONS = Map.of(
            OrderStatus.PENDING_REVIEW, Set.of(OrderStatus.ESTIMATED),
            OrderStatus.ESTIMATED, Set.of(OrderStatus.INVOICED, OrderStatus.ESTIMATED),
            OrderStatus.INVOICED, Set.of(OrderStatus.PAID),
            OrderStatus.PAID, Set.of(OrderStatus.IN_PROGRESS),
            OrderStatus.IN_PROGRESS, Set.of(OrderStatus.READY_FOR_DELIVERY),
            OrderStatus.READY_FOR_DELIVERY, Set.of(OrderStatus.OUT_FOR_DELIVERY),
            OrderStatus.OUT_FOR_DELIVERY, Set.of(OrderStatus.OUT_FOR_DELIVERY, OrderStatus.DELIVERED),
            OrderStatus.DELIVERED, Set.of(),
            OrderStatus.CANCELLED, Set.of());

    private final OrderRepository orderRepository;
    private final UserRepository userRepository;
    private final UserService userService;
    private final CustomerProfileService customerProfileService;
    private final FileStorageService fileStorageService;
    private final AuditService auditService;

    /**
     * Creates a tailoring request in PENDING_REVIEW for the current customer.
     * Structured request fields are persisted directly; {@code measurements}
     * arrives as a JSON string and is sanitised into a map; every reference
     * image is stored and attached.
     */
    @Transactional
    public OrderDTO createOrder(CreateOrderDTO dto) {
        CustomerProfile customer = customerProfileService.getCurrentCustomerProfile();

        Order order = Order.builder()
                .customer(customer)
                .title(resolveTitle(dto))
                .description(trimToNull(dto.getDescription()))
                .garmentType(trimToNull(dto.getGarmentType()))
                .fabricType(trimToNull(dto.getFabricType()))
                .styleDetails(trimToNull(dto.getStyleDetails()))
                .measurements(parseMeasurements(dto.getMeasurements()))
                .preferredDeliveryDate(dto.getPreferredDeliveryDate())
                .specialInstructions(trimToNull(dto.getSpecialInstructions()))
                .status(OrderStatus.PENDING_REVIEW)
                .build();
        orderRepository.save(order);

        attachReferenceImages(order, dto.getReferenceImages());

        auditService.record(AuditService.Actions.ORDER_CREATED, AuditService.ENTITY_ORDER,
                order.getId(), null, AuditService.orderState(order));
        return OrderDTO.from(order);
    }

    /**
     * Assigns (or re-assigns) a TAILOR user to an order. Admin-only; the
     * authorization rule is enforced at the controller via {@code @PreAuthorize}.
     */
    @Transactional
    public OrderDTO assignTailor(Long orderId, AssignTailorRequest request) {
        Order order = getOrder(orderId);
        User tailor = userRepository.findById(request.tailorId())
                .orElseThrow(() -> new ResourceNotFoundException("Tailor user not found: " + request.tailorId()));
        if (tailor.getRole() != Role.TAILOR) {
            throw new IllegalArgumentException("User with id " + request.tailorId() + " is not a TAILOR");
        }

        Map<String, Object> before = AuditService.orderState(order);
        order.setTailor(tailor);
        Map<String, Object> after = AuditService.orderState(order);
        auditService.record(AuditService.Actions.ORDER_TAILOR_ASSIGNED, AuditService.ENTITY_ORDER,
                order.getId(), before, after);
        return OrderDTO.from(order);
    }

    /**
     * Marks an order as ESTIMATED with price, completion date and terms.
     * Only the TAILOR the order is assigned to may submit the estimation, and
     * only while the order is still awaiting review (PENDING_REVIEW) — an
     * already-estimated or further-along order can never be re-estimated.
     */
    @Transactional
    public OrderDTO submitEstimation(Long orderId, TailorEstimationDTO dto) {
        Order order = requireAssignedTailor(userService.getCurrentUser(), orderId);

        if (order.getStatus() != OrderStatus.PENDING_REVIEW) {
            throw new IllegalStateException(
                    "Only orders in PENDING_REVIEW can be estimated, current status: " + order.getStatus());
        }
        Map<String, Object> before = AuditService.orderState(order);
        validateTransition(order, OrderStatus.ESTIMATED);
        order.setEstimatedPrice(dto.estimatedPrice());
        order.setEstimatedCompletionDate(dto.estimatedCompletionDate());
        order.setTermsAndPolicy(dto.termsAndPolicy());
        Map<String, Object> after = AuditService.orderState(order);
        auditService.record(AuditService.Actions.ORDER_ESTIMATED, AuditService.ENTITY_ORDER,
                order.getId(), before, after);
        return OrderDTO.from(order);
    }

    // ---------------- Fulfillment / delivery workflow ----------------

    /**
     * (Tailor) Starts production on a fully paid order: PAID -&gt; IN_PROGRESS.
     * Only the TAILOR the order is assigned to may act.
     */
    @Transactional
    public OrderDTO startProduction(Long orderId) {
        Order order = requireAssignedTailor(userService.getCurrentUser(), orderId);

        Map<String, Object> before = AuditService.orderState(order);
        validateTransition(order, OrderStatus.IN_PROGRESS);
        auditService.record(AuditService.Actions.ORDER_STATUS_CHANGED, AuditService.ENTITY_ORDER,
                order.getId(), before, AuditService.orderState(order));
        return OrderDTO.from(order);
    }

    /**
     * (Tailor) Marks a garment ready to ship: IN_PROGRESS -&gt; READY_FOR_DELIVERY.
     */
    @Transactional
    public OrderDTO markReadyForDelivery(Long orderId) {
        Order order = requireAssignedTailor(userService.getCurrentUser(), orderId);

        Map<String, Object> before = AuditService.orderState(order);
        validateTransition(order, OrderStatus.READY_FOR_DELIVERY);
        auditService.record(AuditService.Actions.ORDER_STATUS_CHANGED, AuditService.ENTITY_ORDER,
                order.getId(), before, AuditService.orderState(order));
        return OrderDTO.from(order);
    }

    /**
     * (Admin/Cashier) Staffs a delivery run by assigning a DELIVERY user. The
     * order keeps its current status: a READY_FOR_DELIVERY garment stays at the
     * shop until the assigned agent dispatches it, and a run already
     * OUT_FOR_DELIVERY can be re-staffed if the first agent falls through.
     */
    @Transactional
    public OrderDTO assignDeliveryAgent(Long orderId, AssignDeliveryRequest request) {
        Order order = getOrder(orderId);
        OrderStatus current = order.getStatus();
        if (current != OrderStatus.READY_FOR_DELIVERY && current != OrderStatus.OUT_FOR_DELIVERY) {
            throw new IllegalStateException(
                    "A delivery agent can only be assigned when the order is READY_FOR_DELIVERY or OUT_FOR_DELIVERY,"
                            + " current status: " + current);
        }

        User deliveryAgent = userRepository.findById(request.deliveryUserId())
                .orElseThrow(() -> new ResourceNotFoundException("Delivery user not found: " + request.deliveryUserId()));
        if (deliveryAgent.getRole() != Role.DELIVERY) {
            throw new IllegalArgumentException("User with id " + request.deliveryUserId() + " is not a DELIVERY");
        }

        Map<String, Object> before = AuditService.orderState(order);
        order.setDeliveryAgent(deliveryAgent);
        Map<String, Object> after = AuditService.orderState(order);
        auditService.record(AuditService.Actions.ORDER_DELIVERY_ASSIGNED, AuditService.ENTITY_ORDER,
                order.getId(), before, after);
        return OrderDTO.from(order);
    }

    /**
     * (Delivery) Dispatches a staffed delivery run:
     * READY_FOR_DELIVERY -&gt; OUT_FOR_DELIVERY. Only the assigned DELIVERY user
     * may take the garment out.
     */
    @Transactional
    public OrderDTO markOutForDelivery(Long orderId) {
        User currentUser = userService.getCurrentUser();
        Order order = getOrder(orderId);

        if (currentUser.getRole() != Role.DELIVERY) {
            throw new AccessDeniedException("Only delivery agents can dispatch an order");
        }
        if (order.getDeliveryAgent() == null || !order.getDeliveryAgent().getId().equals(currentUser.getId())) {
            throw new AccessDeniedException("This order is not assigned to you");
        }

        Map<String, Object> before = AuditService.orderState(order);
        validateTransition(order, OrderStatus.OUT_FOR_DELIVERY);
        auditService.record(AuditService.Actions.ORDER_STATUS_CHANGED, AuditService.ENTITY_ORDER,
                order.getId(), before, AuditService.orderState(order));
        return OrderDTO.from(order);
    }

    /**
     * (Delivery) Confirms hand-over to the customer:
     * OUT_FOR_DELIVERY -&gt; DELIVERED. Only the assigned DELIVERY user may act.
     */
    @Transactional
    public OrderDTO confirmDelivery(Long orderId) {
        User currentUser = userService.getCurrentUser();
        Order order = getOrder(orderId);

        if (currentUser.getRole() != Role.DELIVERY) {
            throw new AccessDeniedException("Only delivery agents can confirm delivery");
        }
        if (order.getDeliveryAgent() == null || !order.getDeliveryAgent().getId().equals(currentUser.getId())) {
            throw new AccessDeniedException("This order is not assigned to you");
        }

        Map<String, Object> before = AuditService.orderState(order);
        validateTransition(order, OrderStatus.DELIVERED);
        auditService.record(AuditService.Actions.ORDER_STATUS_CHANGED, AuditService.ENTITY_ORDER,
                order.getId(), before, AuditService.orderState(order));
        return OrderDTO.from(order);
    }

    /**
     * (Admin) Administrative status correction. Applies the same state machine
     * so no invalid jump is possible (e.g. a delivered order cannot go back).
     */
    @Transactional
    public OrderDTO updateStatus(Long orderId, UpdateOrderStatusDTO dto) {
        Order order = getOrder(orderId);

        Map<String, Object> before = AuditService.orderState(order);
        validateTransition(order, dto.status());
        auditService.record(AuditService.Actions.ORDER_STATUS_CHANGED, AuditService.ENTITY_ORDER,
                order.getId(), before, AuditService.orderState(order));
        return OrderDTO.from(order);
    }

    /**
     * Shared state-machine guard. Rejects any move the current status does not
     * legally allow (e.g. a tailor cannot mark an order ready for delivery
     * until it is IN_PROGRESS) with an IllegalStateException -&gt; HTTP 409.
     */
    private void validateTransition(Order order, OrderStatus target) {
        OrderStatus current = order.getStatus();
        Set<OrderStatus> allowed = ALLOWED_TRANSITIONS.get(current);
        if (allowed == null || !allowed.contains(target)) {
            throw new IllegalStateException("Order cannot move from " + current + " to " + target);
        }
        order.setStatus(target);
    }

    /**
     * Loads an order and verifies the current user is the TAILOR it is
     * assigned to. Used by all tailor-only actions.
     */
    private Order requireAssignedTailor(User currentUser, Long orderId) {
        Order order = getOrder(orderId);

        if (currentUser.getRole() != Role.TAILOR) {
            throw new AccessDeniedException("Only tailors can perform this action");
        }
        if (order.getTailor() == null || !order.getTailor().getId().equals(currentUser.getId())) {
            throw new AccessDeniedException("This order is not assigned to you");
        }
        return order;
    }

    /**
     * Returns orders filtered by the authenticated user's role:
     * customers see only their own, tailors/delivery agents see their assigned
     * orders, admins and cashiers see everything. An optional status narrows
     * the result.
     */
    @Transactional(readOnly = true)
    public List<OrderDTO> getOrdersByRole(OrderStatus status) {
        User currentUser = userService.getCurrentUser();

        List<Order> orders = switch (currentUser.getRole()) {
            case CUSTOMER -> orderRepository.findByCustomer(
                    customerProfileService.getCurrentCustomerProfile(), CREATED_AT_DESC);
            case TAILOR -> orderRepository.findByTailor(currentUser, CREATED_AT_DESC);
            case DELIVERY -> orderRepository.findByDeliveryAgent(currentUser, CREATED_AT_DESC);
            case ADMIN, CASHIER -> orderRepository.findAll(CREATED_AT_DESC);
        };

        return orders.stream()
                .filter(order -> status == null || order.getStatus() == status)
                .map(OrderDTO::from)
                .toList();
    }

    /**
     * Single-order lookup with role-based access control: users may only read
     * orders they own or are assigned to; ADMIN may read any order.
     */
    @Transactional(readOnly = true)
    public OrderDTO getOrderById(Long orderId) {
        Order order = getOrder(orderId);
        User currentUser = userService.getCurrentUser();

        if (currentUser.getRole() != Role.ADMIN) {
            boolean isCustomer = order.getCustomer() != null
                    && order.getCustomer().getUser() != null
                    && order.getCustomer().getUser().getId().equals(currentUser.getId());
            boolean isTailor = order.getTailor() != null
                    && order.getTailor().getId().equals(currentUser.getId());
            boolean isDelivery = order.getDeliveryAgent() != null
                    && order.getDeliveryAgent().getId().equals(currentUser.getId());

            if (!isCustomer && !isTailor && !isDelivery) {
                throw new AccessDeniedException("You cannot view this order");
            }
        }
        return OrderDTO.from(order);
    }

    private Order getOrder(Long orderId) {
        return orderRepository.findById(orderId)
                .orElseThrow(() -> new ResourceNotFoundException("Order not found: " + orderId));
    }

    /**
     * Stores every non-empty reference image and links it to the order. The
     * order stays managed within this transaction, so the cascaded inserts are
     * flushed when the transaction commits.
     */
    private void attachReferenceImages(Order order, List<MultipartFile> images) {
        if (images == null) {
            return;
        }
        for (MultipartFile image : images) {
            if (image == null || image.isEmpty()) {
                continue;
            }
            String fileUrl = fileStorageService.store(image);
            OrderAttachment attachment = OrderAttachment.builder()
                    .order(order)
                    .fileUrl(fileUrl)
                    .fileName(image.getOriginalFilename())
                    .fileType(image.getContentType())
                    .build();
            order.getAttachments().add(attachment);
        }
    }

    /**
     * When the customer does not provide a free-text title (the new request
     * form does not), fall back to the garment type, then to a generic label.
     */
    private String resolveTitle(CreateOrderDTO dto) {
        String title = trimToNull(dto.getTitle());
        if (title != null) {
            return title;
        }
        String garmentType = trimToNull(dto.getGarmentType());
        return garmentType != null ? garmentType : "Custom tailoring request";
    }

    /**
     * Parses the JSON-encoded measurements and drops blank entries so a stale
     * or empty payload never leaves dangling keys in the stored document.
     */
    private Map<String, Object> parseMeasurements(String raw) {
        Map<String, Object> parsed = JsonMapConverter.parseClientJson(raw);
        if (parsed == null || parsed.isEmpty()) {
            return null;
        }
        Map<String, Object> cleaned = new LinkedHashMap<>();
        parsed.forEach((key, value) -> {
            if (key == null || key.isBlank()) {
                return;
            }
            String normalizedValue = value == null ? null : value.toString().trim();
            if (normalizedValue != null && !normalizedValue.isEmpty()) {
                cleaned.put(key.trim(), normalizedValue);
            }
        });
        return cleaned.isEmpty() ? null : cleaned;
    }

    private String trimToNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}