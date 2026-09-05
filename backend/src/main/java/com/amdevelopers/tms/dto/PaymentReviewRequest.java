package com.amdevelopers.tms.dto;

import jakarta.validation.constraints.Size;

/**
 * Body for the cashier acting on a pending payment proof. The note is
 * recommended on approval (e.g. "Verified — JazzCash receipt matches the
 * invoice total") and mandatory when rejecting, since it is shown to the
 * customer as the reason.
 *
 * @param note cashier's verdict note
 */
public record PaymentReviewRequest(
        @Size(max = 2000, message = "Review note must be at most 2000 characters") String note) {
}
