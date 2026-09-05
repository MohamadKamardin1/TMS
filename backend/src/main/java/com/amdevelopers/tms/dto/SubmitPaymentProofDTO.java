package com.amdevelopers.tms.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.web.multipart.MultipartFile;

/**
 * Multipart payload for a customer submitting payment proof against an issued
 * invoice. The screenshot is the evidence (a bank/app transfer receipt); the
 * message lets the customer describe how they paid (method, reference, time)
 * so the cashier can verify quickly. Both are required.
 */
@Data
@NoArgsConstructor
public class SubmitPaymentProofDTO {

    @NotNull(message = "Invoice is required")
    private Long invoiceId;

    @NotBlank(message = "Please describe how you made the payment (method, reference, date).")
    @Size(max = 4000, message = "Payment message must be at most 4000 characters")
    private String message;

    @NotNull(message = "Please attach a screenshot of the payment as proof.")
    private MultipartFile screenshot;
}
