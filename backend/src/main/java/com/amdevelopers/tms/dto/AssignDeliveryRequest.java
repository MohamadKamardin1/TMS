package com.amdevelopers.tms.dto;

import jakarta.validation.constraints.NotNull;

public record AssignDeliveryRequest(
        @NotNull(message = "Delivery user id is required") Long deliveryUserId) {
}