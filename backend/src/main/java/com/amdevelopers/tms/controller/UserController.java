package com.amdevelopers.tms.controller;

import com.amdevelopers.tms.dto.ApiResponse;
import com.amdevelopers.tms.dto.UserDTO;
import com.amdevelopers.tms.enums.Role;
import com.amdevelopers.tms.services.UserService;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    @GetMapping("/me")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<UserDTO>> me() {
        return ResponseEntity.ok(ApiResponse.success(UserDTO.from(userService.getCurrentUser())));
    }

    /**
     * Staff roster for assignment dropdowns. Admin-only.
     */
    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<List<UserDTO>>> list(@RequestParam(required = false) Role role) {
        return ResponseEntity.ok(ApiResponse.success(
                userService.listUsersByRole(role).stream().map(UserDTO::from).toList()));
    }
}