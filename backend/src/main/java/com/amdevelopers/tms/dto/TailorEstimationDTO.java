package com.amdevelopers.tms.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.LocalDate;

public record TailorEstimationDTO(
        @NotNull(message = "Estimated price is required")
        @PositiveOrZero(message = "Estimated price must be zero or positive")
        BigDecimal estimatedPrice,

        @NotNull(message = "Estimated completion date is required")
        LocalDate estimatedCompletionDate,

        @Size(max = 2000, message = "Terms and policy must be at most 2000 characters")
        String termsAndPolicy) {
}