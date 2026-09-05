package com.amdevelopers.tms.services;

import com.amdevelopers.tms.dto.AssignDeliveryRequest;
import com.amdevelopers.tms.dto.AssignTailorRequest;
import com.amdevelopers.tms.dto.CreateOrderDTO;
import com.amdevelopers.tms.dto.FeedbackDTO;
import com.amdevelopers.tms.dto.OrderDTO;
import com.amdevelopers.tms.dto.TailorEstimationDTO;
import com.amdevelopers.tms.dto.UpdateOrderStatusDTO;
import com.amdevelopers.tms.entity.CustomerProfile;
import com.amdevelopers.tms.entity.Feedback;
import com.amdevelopers.tms.entity.Order;
import com.amdevelopers.tms.entity.OrderAttachment;
import com.amdevelopers.tms.entity.User;
import com.amdevelopers.tms.enums.OrderStatus;
import com.amdevelopers.tms.enums.Role;
import com.amdevelopers.tms.exceptions.ResourceNotFoundException;
import com.amdevelopers.tms.repositories.FeedbackRepository;
import com.amdevelopers.tms.repositories.OrderRepository;
import com.amdevelopers.tms.repositories.UserRepository;
import java.util.List;
import java.util.Map;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

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
    private final FeedbackRepository feedbackRepository;

    /**
     * Creates an order in PENDING_REVIEW for the current customer and stores
     * the reference image (if any) as an attachment.
     */
    @Transactional
    public OrderDTO createOrder(CreateOrderDTO dto) {
        CustomerProfile customer = customerProfileService.getCurrentCustomerProfile();

        Order order = Order.builder()
                .customer(customer)
                .title(dto.getTitle())
                .description(dto.getDescription())
                .requiredCompletionDate(dto.getRequiredCompletionDate())
                .status(OrderStatus.PENDING_REVIEW)
                .build();
        orderRepository.save(order);

        if (dto.getReferenceImage() != null && !dto.getReferenceImage().isEmpty()) {
            String fileUrl = fileStorageService.store(dto.getReferenceImage());
            OrderAttachment attachment = OrderAttachment.builder()
                    .order(order)
                    .fileUrl(fileUrl)
                    .fileName(dto.getReferenceImage().getOriginalFilename())
                    .fileType(dto.getReferenceImage().getContentType())
                    .build();
            order.getAttachments().add(attachment);
        }

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

        order.setTailor(tailor);
        return OrderDTO.from(order);
    }

    /**
     * Marks an order as ESTIMATED with price, completion date and terms.
     * Only the TAILOR the order is assigned to may submit the estimation.
     */
    @Transactional
    public OrderDTO submitEstimation(Long orderId, TailorEstimationDTO dto) {
        Order order = requireAssignedTailor(userService.getCurrentUser(), orderId);

        validateTransition(order, OrderStatus.ESTIMATED);
        order.setEstimatedPrice(dto.estimatedPrice());
        order.setEstimatedCompletionDate(dto.estimatedCompletionDate());
        order.setTermsAndPolicy(dto.termsAndPolicy());
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

        validateTransition(order, OrderStatus.IN_PROGRESS);
        return OrderDTO.from(order);
    }

    /**
     * (Tailor) Marks a garment ready to ship: IN_PROGRESS -&gt; READY_FOR_DELIVERY.
     */
    @Transactional
    public OrderDTO markReadyForDelivery(Long orderId) {
        Order order = requireAssignedTailor(userService.getCurrentUser(), orderId);

        validateTransition(order, OrderStatus.READY_FOR_DELIVERY);
        return OrderDTO.from(order);
    }

    /**
     * (Admin/Cashier) Assigns a DELIVERY user and moves the order out for
     * delivery: READY_FOR_DELIVERY -&gt; OUT_FOR_DELIVERY. Re-assigning while
     * already OUT_FOR_DELIVERY is allowed and keeps the same status.
     */
    @Transactional
    public OrderDTO assignDelivery(Long orderId, AssignDeliveryRequest request) {
        Order order = getOrder(orderId);
        User deliveryAgent = userRepository.findById(request.deliveryUserId())
                .orElseThrow(() -> new ResourceNotFoundException("Delivery user not found: " + request.deliveryUserId()));
        if (deliveryAgent.getRole() != Role.DELIVERY) {
            throw new IllegalArgumentException("User with id " + request.deliveryUserId() + " is not a DELIVERY");
        }

        order.setDeliveryAgent(deliveryAgent);
        validateTransition(order, OrderStatus.OUT_FOR_DELIVERY);
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

        validateTransition(order, OrderStatus.DELIVERED);
        return OrderDTO.from(order);
    }

    /**
     * (Admin) Administrative status correction. Applies the same state machine
     * so no invalid jump is possible (e.g. a delivered order cannot go back).
     */
    @Transactional
    public OrderDTO updateStatus(Long orderId, UpdateOrderStatusDTO dto) {
        Order order = getOrder(orderId);

        validateTransition(order, dto.status());
        return OrderDTO.from(order);
    }

    /**
     * (Customer) Records feedback for a delivered order (one per order).
     * Only the customer who placed the order may submit it, and only once the
     * order has been DELIVERED.
     */
    @Transactional
    public FeedbackDTO submitFeedback(FeedbackDTO dto) {
        Order order = getOrder(dto.orderId());
        User currentUser = userService.getCurrentUser();

        if (currentUser.getRole() != Role.CUSTOMER) {
            throw new AccessDeniedException("Only customers can submit feedback");
        }
        if (order.getCustomer() == null || order.getCustomer().getUser() == null
                || !order.getCustomer().getUser().getId().equals(currentUser.getId())) {
            throw new AccessDeniedException("You can only provide feedback for your own orders");
        }
        if (order.getStatus() != OrderStatus.DELIVERED) {
            throw new IllegalStateException(
                    "Feedback is only allowed after the order is DELIVERED, current status: " + order.getStatus());
        }
        if (feedbackRepository.findByOrder(order).isPresent()) {
            throw new IllegalStateException("Feedback has already been submitted for order " + dto.orderId());
        }

        Feedback feedback = Feedback.builder()
                .order(order)
                .customer(order.getCustomer())
                .rating(dto.rating())
                .comments(dto.comments())
                .build();
        feedbackRepository.save(feedback);
        return FeedbackDTO.from(feedback);
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
}