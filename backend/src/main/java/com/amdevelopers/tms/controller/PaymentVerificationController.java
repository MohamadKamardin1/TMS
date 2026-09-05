package com.amdevelopers.tms.controller;

import com.amdevelopers.tms.dto.ApiResponse;
import com.amdevelopers.tms.dto.PaymentReviewRequest;
import com.amdevelopers.tms.dto.PaymentVerificationDTO;
import com.amdevelopers.tms.dto.SubmitPaymentProofDTO;
import com.amdevelopers.tms.enums.VerificationStatus;
import com.amdevelopers.tms.services.PaymentVerificationService;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Payment-proof endpoints. Customers submit proof for the invoices they own;
 * cashiers/admins list the pending queue and approve (settling the payment) or
 * reject with a reason.
 */
@RestController
@RequestMapping("/api/payment-verifications")
@RequiredArgsConstructor
public class PaymentVerificationController {

    private final PaymentVerificationService verificationService;

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasRole('CUSTOMER')")
    public ResponseEntity<ApiResponse<PaymentVerificationDTO>> submit(
            @ModelAttribute @Valid SubmitPaymentProofDTO dto) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Payment proof submitted — awaiting verification",
                        verificationService.submit(dto)));
    }

    @GetMapping
    @PreAuthorize("hasRole('CASHIER') or hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<List<PaymentVerificationDTO>>> list(
            @RequestParam(required = false) VerificationStatus status) {
        return ResponseEntity.ok(ApiResponse.success(verificationService.listForStaff(status)));
    }

    @GetMapping("/invoice/{invoiceId}")
    @PreAuthorize("hasRole('CUSTOMER')")
    public ResponseEntity<ApiResponse<List<PaymentVerificationDTO>>> listMine(
            @PathVariable Long invoiceId) {
        return ResponseEntity.ok(ApiResponse.success(verificationService.listForCustomer(invoiceId)));
    }

    @PostMapping("/{id}/approve")
    @PreAuthorize("hasRole('CASHIER') or hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<PaymentVerificationDTO>> approve(
            @PathVariable Long id, @Valid @RequestBody(required = false) PaymentReviewRequest request) {
        String note = request == null ? null : request.note();
        return ResponseEntity.ok(ApiResponse.success("Payment verified — invoice marked paid",
                verificationService.approve(id, note)));
    }

    @PostMapping("/{id}/reject")
    @PreAuthorize("hasRole('CASHIER') or hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<PaymentVerificationDTO>> reject(
            @PathVariable Long id, @Valid @RequestBody(required = false) PaymentReviewRequest request) {
        String note = request == null ? null : request.note();
        return ResponseEntity.ok(ApiResponse.success("Payment proof rejected",
                verificationService.reject(id, note)));
    }
}
