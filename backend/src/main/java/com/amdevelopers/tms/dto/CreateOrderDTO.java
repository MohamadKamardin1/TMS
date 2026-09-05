package com.amdevelopers.tms.dto;

import jakarta.validation.constraints.Future;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.web.multipart.MultipartFile;

/**
 * Multipart form payload for creating an order. The optional
 * {@code referenceImage} is saved as an {@code OrderAttachment}.
 */
@Data
@NoArgsConstructor
public class CreateOrderDTO {

    @NotBlank(message = "Title is required")
    @Size(max = 100, message = "Title must be at most 100 characters")
    private String title;

    @Size(max = 2000, message = "Description must be at most 2000 characters")
    private String description;

    @Future(message = "Required completion date must be in the future")
    private LocalDate requiredCompletionDate;

    private MultipartFile referenceImage;
}