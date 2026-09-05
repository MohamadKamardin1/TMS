package com.amdevelopers.tms.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Request to assign a new role to a user. Sent as a plain string and mapped to
 * the {@link com.amdevelopers.tms.enums.Role} enum in the service so an unknown
 * value yields a clear 400 rather than a Jackson mapping error.
 */
public record UpdateRoleRequest(
        @NotBlank(message = "Role is required")
        @Size(max = 20, message = "Role must be at most 20 characters")
        String role) {
}
