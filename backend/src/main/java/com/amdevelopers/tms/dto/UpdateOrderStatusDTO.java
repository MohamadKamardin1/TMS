package com.amdevelopers.tms.dto;

import com.amdevelopers.tms.enums.OrderStatus;
import jakarta.validation.constraints.NotNull;

public record UpdateOrderStatusDTO(
        @NotNull(message = "Status is required") OrderStatus status) {
}