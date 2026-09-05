package com.amdevelopers.tms.controller;

import com.amdevelopers.tms.dto.ApiResponse;
import com.amdevelopers.tms.dto.InvoiceDTO;
import com.amdevelopers.tms.dto.InvoiceDraftDTO;
import com.amdevelopers.tms.enums.InvoiceStatus;
import com.amdevelopers.tms.services.InvoiceService;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Invoice endpoints for the billing workflow (Cashier/Admin). Drafts are created
 * and edited before being issued; issued documents are paid or (once past due)
 * reported overdue.
 */
@RestController
@RequestMapping("/api/invoices")
@RequiredArgsConstructor
public class InvoiceController {

    private final InvoiceService invoiceService;

    @PostMapping
    @PreAuthorize("hasRole('CASHIER') or hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<InvoiceDTO>> generate(
            @RequestParam Long orderId, @Valid @RequestBody(required = false) InvoiceDraftDTO dto) {
        InvoiceDraftDTO body = dto == null ? new InvoiceDraftDTO(null, null, null, null, null) : dto;
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Invoice draft created", invoiceService.generateInvoice(orderId, body)));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('CASHIER') or hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<InvoiceDTO>> update(
            @PathVariable Long id, @Valid @RequestBody InvoiceDraftDTO dto) {
        return ResponseEntity.ok(ApiResponse.success("Invoice draft updated", invoiceService.updateInvoice(id, dto)));
    }

    @PostMapping("/{id}/issue")
    @PreAuthorize("hasRole('CASHIER') or hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<InvoiceDTO>> issue(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success("Invoice issued", invoiceService.issueInvoice(id)));
    }

    @PostMapping("/{id}/record-payment")
    @PreAuthorize("hasRole('CASHIER') or hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<InvoiceDTO>> recordPayment(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success("Payment recorded", invoiceService.recordPayment(id)));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('CASHIER') or hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<Void>> discard(@PathVariable Long id) {
        invoiceService.discardDraft(id);
        return ResponseEntity.ok(ApiResponse.success("Draft invoice discarded", null));
    }

    @GetMapping
    @PreAuthorize("hasRole('CASHIER') or hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<List<InvoiceDTO>>> list(
            @RequestParam(required = false) InvoiceStatus status) {
        return ResponseEntity.ok(ApiResponse.success(invoiceService.getInvoicesByStatus(status)));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasRole('CASHIER') or hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<InvoiceDTO>> getById(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(invoiceService.getInvoice(id)));
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
