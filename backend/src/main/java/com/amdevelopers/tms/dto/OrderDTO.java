package com.amdevelopers.tms.dto;

import com.amdevelopers.tms.entity.CustomerProfile;
import com.amdevelopers.tms.entity.Order;
import com.amdevelopers.tms.entity.OrderAttachment;
import com.amdevelopers.tms.entity.User;
import com.amdevelopers.tms.enums.OrderStatus;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * Full read model of an order, covering both the customer's tailoring request
 * details and the tailor's estimation, so every role sees the whole picture.
 */
public record OrderDTO(
        Long id,
        Long customerId,
        String customerName,
        Long tailorId,
        String tailorName,
        Long deliveryId,
        String deliveryName,
        String title,
        String description,
        String garmentType,
        String fabricType,
        String styleDetails,
        Map<String, Object> measurements,
        LocalDate preferredDeliveryDate,
        String specialInstructions,
        BigDecimal estimatedPrice,
        LocalDate estimatedCompletionDate,
        String termsAndPolicy,
        OrderStatus status,
        LocalDateTime createdAt,
        LocalDateTime updatedAt,
        List<AttachmentDTO> attachments) {

    public record AttachmentDTO(Long id, String fileName, String fileType, String fileUrl) {

        public static AttachmentDTO from(OrderAttachment attachment) {
            return new AttachmentDTO(
                    attachment.getId(),
                    attachment.getFileName(),
                    attachment.getFileType(),
                    attachment.getFileUrl());
        }
    }

    /**
     * Maps an {@link Order}. Must be called inside a transaction because
     * {@code customer} and {@code tailor} are lazily fetched.
     */
    public static OrderDTO from(Order order) {
        CustomerProfile customer = order.getCustomer();
        User tailor = order.getTailor();
        User deliveryAgent = order.getDeliveryAgent();
        List<AttachmentDTO> attachments = order.getAttachments() == null
                ? List.of()
                : order.getAttachments().stream().map(AttachmentDTO::from).toList();
        Map<String, Object> measurements = order.getMeasurements() == null
                ? Map.of()
                : order.getMeasurements();

        return new OrderDTO(
                order.getId(),
                customer != null ? customer.getId() : null,
                customer != null && customer.getUser() != null ? customer.getUser().getFullName() : null,
                tailor != null ? tailor.getId() : null,
                tailor != null ? tailor.getFullName() : null,
                deliveryAgent != null ? deliveryAgent.getId() : null,
                deliveryAgent != null ? deliveryAgent.getFullName() : null,
                order.getTitle(),
                order.getDescription(),
                order.getGarmentType(),
                order.getFabricType(),
                order.getStyleDetails(),
                measurements,
                order.getPreferredDeliveryDate(),
                order.getSpecialInstructions(),
                order.getEstimatedPrice(),
                order.getEstimatedCompletionDate(),
                order.getTermsAndPolicy(),
                order.getStatus(),
                order.getCreatedAt(),
                order.getUpdatedAt(),
                attachments);
    }
}
