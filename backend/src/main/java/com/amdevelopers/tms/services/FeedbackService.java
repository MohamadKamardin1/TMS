package com.amdevelopers.tms.services;

import com.amdevelopers.tms.dto.FeedbackDTO;
import com.amdevelopers.tms.entity.Feedback;
import com.amdevelopers.tms.entity.Order;
import com.amdevelopers.tms.entity.User;
import com.amdevelopers.tms.enums.OrderStatus;
import com.amdevelopers.tms.enums.Role;
import com.amdevelopers.tms.exceptions.ResourceNotFoundException;
import com.amdevelopers.tms.repositories.FeedbackRepository;
import com.amdevelopers.tms.repositories.OrderRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Customer feedback for delivered orders. Submission is deliberately narrow:
 * only the CUSTOMER who placed the order may rate it, only once the order has
 * reached the terminal DELIVERED status, and at most one review per order.
 * Reading feedback follows the same access rules as reading the order itself,
 * so customers see their own review and tailors/delivery agents/admins see the
 * reviews on orders they worked on.
 */
@Service
@RequiredArgsConstructor
public class FeedbackService {

    private final OrderRepository orderRepository;
    private final FeedbackRepository feedbackRepository;
    private final UserService userService;

    @Transactional
    public FeedbackDTO submit(FeedbackDTO dto) {
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
     * Loads the review for an order, or {@code null} when the customer has not
     * submitted one yet. The caller must already be allowed to read the order;
     * any other user is rejected.
     */
    @Transactional(readOnly = true)
    public FeedbackDTO getForOrder(Long orderId) {
        Order order = getOrder(orderId);
        User currentUser = userService.getCurrentUser();

        if (!canRead(order, currentUser)) {
            throw new AccessDeniedException("You cannot view this order");
        }
        return feedbackRepository.findByOrder(order)
                .map(FeedbackDTO::from)
                .orElse(null);
    }

    private boolean canRead(Order order, User currentUser) {
        if (currentUser.getRole() == Role.ADMIN) {
            return true;
        }
        boolean isCustomer = order.getCustomer() != null
                && order.getCustomer().getUser() != null
                && order.getCustomer().getUser().getId().equals(currentUser.getId());
        boolean isTailor = order.getTailor() != null
                && order.getTailor().getId().equals(currentUser.getId());
        boolean isDelivery = order.getDeliveryAgent() != null
                && order.getDeliveryAgent().getId().equals(currentUser.getId());
        return isCustomer || isTailor || isDelivery;
    }

    private Order getOrder(Long orderId) {
        return orderRepository.findById(orderId)
                .orElseThrow(() -> new ResourceNotFoundException("Order not found: " + orderId));
    }
}
