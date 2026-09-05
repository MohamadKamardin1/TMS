package com.amdevelopers.tms.dto;

import jakarta.validation.constraints.NotNull;

/**
 * Explicit, idempotent activation request ({@code {"active": true|false}}).
 * Preferring an explicit target over "toggle" avoids two admins racing to flip
 * the same account into an unintended state.
 */
public record UpdateUserStatusRequest(
        @NotNull(message = "active is required") Boolean active) {
}
