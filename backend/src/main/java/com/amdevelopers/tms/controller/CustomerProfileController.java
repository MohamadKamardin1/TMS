package com.amdevelopers.tms.controller;

import com.amdevelopers.tms.dto.ApiResponse;
import com.amdevelopers.tms.dto.CustomerProfileDTO;
import com.amdevelopers.tms.services.CustomerProfileService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Customer profile endpoints. Role checks happen via {@link PreAuthorize};
 * the per-record ownership rule (customer may only touch their own profile,
 * ADMIN may touch any) is enforced inside {@link CustomerProfileService}.
 */
@RestController
@RequestMapping("/api/customers")
@RequiredArgsConstructor
public class CustomerProfileController {

    private final CustomerProfileService customerProfileService;

    @GetMapping("/me")
    @PreAuthorize("hasRole('CUSTOMER') or hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<CustomerProfileDTO>> me() {
        return ResponseEntity.ok(ApiResponse.success(customerProfileService.getCurrentProfile()));
    }

    @PutMapping("/me/measurements")
    @PreAuthorize("hasRole('CUSTOMER') or hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<CustomerProfileDTO>> updateMyMeasurements(
            @Valid @RequestBody CustomerProfileDTO dto) {
        CustomerProfileDTO updated = customerProfileService.updateCurrentMeasurements(dto);
        return ResponseEntity.ok(ApiResponse.success("Measurements updated", updated));
    }

    @PutMapping("/{id}/measurements")
    @PreAuthorize("hasRole('CUSTOMER') or hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<CustomerProfileDTO>> updateMeasurements(
            @PathVariable Long id, @Valid @RequestBody CustomerProfileDTO dto) {
        CustomerProfileDTO updated = customerProfileService.updateMeasurements(id, dto);
        return ResponseEntity.ok(ApiResponse.success("Measurements updated", updated));
    }
}