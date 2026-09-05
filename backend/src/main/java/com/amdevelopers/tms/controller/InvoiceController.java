package com.amdevelopers.tms.controller;

import com.amdevelopers.tms.dto.ApiResponse;
import com.amdevelopers.tms.dto.GenerateInvoiceDTO;
import com.amdevelopers.tms.dto.InvoiceDTO;
import com.amdevelopers.tms.dto.UpdatePaymentStatusDTO;
import com.amdevelopers.tms.services.InvoiceService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Cashier/Admin endpoints for invoice generation and payment handling.
 */
@RestController
@RequestMapping("/api/invoices")
@RequiredArgsConstructor
public class InvoiceController {

    private final InvoiceService invoiceService;

    @PostMapping
    @PreAuthorize("hasRole('CASHIER') or hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<InvoiceDTO>> generate(
            @RequestParam Long orderId, @Valid @RequestBody GenerateInvoiceDTO dto) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Invoice generated", invoiceService.generateInvoice(orderId, dto)));
    }

    @PatchMapping("/{id}/status")
    @PreAuthorize("hasRole('CASHIER') or hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<InvoiceDTO>> updateStatus(
            @PathVariable Long id, @Valid @RequestBody UpdatePaymentStatusDTO dto) {
        return ResponseEntity.ok(ApiResponse.success("Payment status updated",
                invoiceService.markAsPaid(id, dto)));
    }

    @GetMapping("/order/{orderId}")
    @PreAuthorize("hasRole('CASHIER') or hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<InvoiceDTO>> getByOrder(@PathVariable Long orderId) {
        return ResponseEntity.ok(ApiResponse.success(invoiceService.getInvoiceByOrder(orderId)));
    }

    @GetMapping("/my-order/{orderId}")
    @PreAuthorize("hasRole('CUSTOMER')")
    public ResponseEntity<ApiResponse<InvoiceDTO>> getMyOrderInvoice(@PathVariable Long orderId) {
        return ResponseEntity.ok(ApiResponse.success(invoiceService.getInvoiceForCustomer(orderId)));
    }
}