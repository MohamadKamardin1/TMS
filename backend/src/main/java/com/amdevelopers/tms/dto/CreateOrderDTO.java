package com.amdevelopers.tms.dto;

import jakarta.validation.constraints.FutureOrPresent;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import java.util.List;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.web.multipart.MultipartFile;

/**
 * Multipart form payload for a tailoring request. Structured fields (garment
 * type, fabric, style, measurements, delivery preference, instructions) carry
 * the professional request details; {@code referenceImages} holds zero or more
 * reference photos, each persisted as an {@code OrderAttachment}.
 *
 * <p>{@code measurements} travels over the wire as a JSON-encoded string
 * (e.g. {@code {"chest":"40","waist":"32"}}) because multipart parts cannot
 * carry nested objects natively. The service parses and sanitises it into a
 * map before persisting.
 */
@Data
@NoArgsConstructor
public class CreateOrderDTO {

    @Size(max = 100, message = "Title must be at most 100 characters")
    private String title;

    @Size(max = 2000, message = "Description must be at most 2000 characters")
    private String description;

    @Size(max = 100, message = "Garment type must be at most 100 characters")
    private String garmentType;

    @Size(max = 100, message = "Fabric type must be at most 100 characters")
    private String fabricType;

    @Size(max = 4000, message = "Style details must be at most 4000 characters")
    private String styleDetails;

    /**
     * JSON object string of the customer's measurements (e.g. chest, waist,
     * length). Optional — a customer may rely on their saved profile instead.
     */
    @Size(max = 4000, message = "Measurements must be at most 4000 characters")
    private String measurements;

    @FutureOrPresent(message = "Preferred delivery date cannot be in the past")
    private LocalDate preferredDeliveryDate;

    @Size(max = 4000, message = "Special instructions must be at most 4000 characters")
    private String specialInstructions;

    private List<MultipartFile> referenceImages;
}
