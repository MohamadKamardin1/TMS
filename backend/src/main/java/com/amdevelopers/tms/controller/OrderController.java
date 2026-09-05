package com.amdevelopers.tms.controller;

import com.amdevelopers.tms.dto.ApiResponse;
import com.amdevelopers.tms.dto.AssignDeliveryRequest;
import com.amdevelopers.tms.dto.AssignTailorRequest;
import com.amdevelopers.tms.dto.CreateOrderDTO;
import com.amdevelopers.tms.dto.OrderDTO;
import com.amdevelopers.tms.dto.TailorEstimationDTO;
import com.amdevelopers.tms.dto.UpdateOrderStatusDTO;
import com.amdevelopers.tms.enums.OrderStatus;
import com.amdevelopers.tms.services.OrderService;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Order endpoints covering the whole lifecycle: customers create orders,
 * admin assigns tailors, tailors estimate and fulfill, staff assigns delivery,
 * delivery agents confirm hand-over. List and get are role-filtered on the
 * service side; every status change passes the shared state-machine guard.
 */
@RestController
@RequestMapping("/api/orders")
@RequiredArgsConstructor
public class OrderController {

    private final OrderService orderService;

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @PreAuthorize("hasRole('CUSTOMER')")
    public ResponseEntity<ApiResponse<OrderDTO>> create(@ModelAttribute @Valid CreateOrderDTO dto) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Order created", orderService.createOrder(dto)));
    }

    @PostMapping("/{id}/estimation")
    @PreAuthorize("hasRole('TAILOR')")
    public ResponseEntity<ApiResponse<OrderDTO>> submitEstimation(
            @PathVariable Long id, @Valid @RequestBody TailorEstimationDTO dto) {
        return ResponseEntity.ok(ApiResponse.success("Estimation submitted",
                orderService.submitEstimation(id, dto)));
    }

    @PostMapping("/{id}/assign-tailor")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<OrderDTO>> assignTailor(
            @PathVariable Long id, @Valid @RequestBody AssignTailorRequest request) {
        return ResponseEntity.ok(ApiResponse.success("Tailor assigned",
                orderService.assignTailor(id, request)));
    }

    @PostMapping("/{id}/start-production")
    @PreAuthorize("hasRole('TAILOR')")
    public ResponseEntity<ApiResponse<OrderDTO>> startProduction(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success("Production started",
                orderService.startProduction(id)));
    }

    @PostMapping("/{id}/ready-for-delivery")
    @PreAuthorize("hasRole('TAILOR')")
    public ResponseEntity<ApiResponse<OrderDTO>> markReadyForDelivery(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success("Order is ready for delivery",
                orderService.markReadyForDelivery(id)));
    }

    @PostMapping("/{id}/assign-delivery")
    @PreAuthorize("hasRole('ADMIN') or hasRole('CASHIER')")
    public ResponseEntity<ApiResponse<OrderDTO>> assignDelivery(
            @PathVariable Long id, @Valid @RequestBody AssignDeliveryRequest request) {
        return ResponseEntity.ok(ApiResponse.success("Delivery agent assigned",
                orderService.assignDelivery(id, request)));
    }

    @PostMapping("/{id}/confirm-delivery")
    @PreAuthorize("hasRole('DELIVERY')")
    public ResponseEntity<ApiResponse<OrderDTO>> confirmDelivery(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success("Delivery confirmed",
                orderService.confirmDelivery(id)));
    }

    @PatchMapping("/{id}/status")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<OrderDTO>> updateStatus(
            @PathVariable Long id, @Valid @RequestBody UpdateOrderStatusDTO dto) {
        return ResponseEntity.ok(ApiResponse.success("Status updated",
                orderService.updateStatus(id, dto)));
    }

    @GetMapping
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<List<OrderDTO>>> list(
            @RequestParam(required = false) OrderStatus status) {
        return ResponseEntity.ok(ApiResponse.success(orderService.getOrdersByRole(status)));
    }

    @GetMapping("/{id}")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<OrderDTO>> getById(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success(orderService.getOrderById(id)));
    }
}