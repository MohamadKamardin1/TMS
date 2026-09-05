package com.amdevelopers.tms.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record AssignTailorRequest(
        @NotNull(message = "Tailor user id is required") Long tailorId) {
}