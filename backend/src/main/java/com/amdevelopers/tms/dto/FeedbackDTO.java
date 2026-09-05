package com.amdevelopers.tms.dto;

import com.amdevelopers.tms.entity.Feedback;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.LocalDateTime;

public record FeedbackDTO(
        Long id,

        @NotNull(message = "Order id is required")
        Long orderId,

        @NotNull(message = "Rating is required")
        @Min(value = 1, message = "Rating must be between 1 and 5")
        @Max(value = 5, message = "Rating must be between 1 and 5")
        Integer rating,

        @Size(max = 2000, message = "Comments must be at most 2000 characters")
        String comments,

        LocalDateTime createdAt) {

    public static FeedbackDTO from(Feedback feedback) {
        return new FeedbackDTO(
                feedback.getId(),
                feedback.getOrder().getId(),
                feedback.getRating(),
                feedback.getComments(),
                feedback.getCreatedAt());
    }
}