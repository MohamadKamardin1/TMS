package com.amdevelopers.tms.controller;

import com.amdevelopers.tms.dto.ApiResponse;
import com.amdevelopers.tms.dto.FeedbackDTO;
import com.amdevelopers.tms.services.OrderService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Customer feedback for delivered orders. Only the CUSTOMER who placed the
 * order may submit, and only while the order is DELIVERED (one per order).
 */
@RestController
@RequestMapping("/api/feedback")
@RequiredArgsConstructor
public class FeedbackController {

    private final OrderService orderService;

    @PostMapping
    @PreAuthorize("hasRole('CUSTOMER')")
    public ResponseEntity<ApiResponse<FeedbackDTO>> submit(@Valid @RequestBody FeedbackDTO dto) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Feedback submitted", orderService.submitFeedback(dto)));
    }
}