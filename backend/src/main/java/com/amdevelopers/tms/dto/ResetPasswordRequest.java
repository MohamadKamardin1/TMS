package com.amdevelopers.tms.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Admin-initiated password reset. Mirrors the registration password policy so a
 * password that would be rejected at sign-up cannot be forced onto an account.
 */
public record ResetPasswordRequest(
        @NotBlank(message = "New password is required")
        @Size(min = 8, max = 64, message = "Password must be between 8 and 64 characters")
        String newPassword) {
}
