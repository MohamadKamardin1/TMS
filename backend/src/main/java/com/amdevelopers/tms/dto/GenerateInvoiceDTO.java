package com.amdevelopers.tms.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;

public record GenerateInvoiceDTO(
        @NotNull(message = "Amount is required")
        @PositiveOrZero(message = "Amount must be zero or positive")
        BigDecimal amount,

        @Size(max = 50, message = "Account number must be at most 50 characters")
        String accountNumber,

        @NotBlank(message = "Reference number is required")
        @Size(max = 50, message = "Reference number must be at most 50 characters")
        String referenceNumber) {
}