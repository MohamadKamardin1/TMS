package com.amdevelopers.tms.dto;

import com.amdevelopers.tms.enums.PaymentStatus;
import jakarta.validation.constraints.NotNull;

public record UpdatePaymentStatusDTO(
        @NotNull(message = "Payment status is required") PaymentStatus paymentStatus) {
}