package com.amdevelopers.tms.controller;

import com.amdevelopers.tms.dto.ApiResponse;
import com.amdevelopers.tms.dto.ResetPasswordRequest;
import com.amdevelopers.tms.dto.UpdateRoleRequest;
import com.amdevelopers.tms.dto.UpdateUserStatusRequest;
import com.amdevelopers.tms.dto.UserDTO;
import com.amdevelopers.tms.entity.User;
import com.amdevelopers.tms.enums.Role;
import com.amdevelopers.tms.services.UserService;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
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
     * Staff roster for assignment dropdowns, or the full account list (no role
     * filter) for the User Management screen. Admin-only.
     */
    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<List<UserDTO>>> list(@RequestParam(required = false) Role role) {
        List<User> users = role == null ? userService.getAllUsers() : userService.listUsersByRole(role);
        return ResponseEntity.ok(ApiResponse.success(users.stream().map(UserDTO::from).toList()));
    }

    /** (Admin) Reassigns a user's role. */
    @PatchMapping("/{id}/role")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<UserDTO>> updateRole(
            @PathVariable Long id, @Valid @RequestBody UpdateRoleRequest request) {
        User updated = userService.updateUserRole(id, request.role());
        return ResponseEntity.ok(ApiResponse.success("Role updated to " + updated.getRole().name(),
                UserDTO.from(updated)));
    }

    /** (Admin) Activates/deactivates an account; immediately revokes access. */
    @PatchMapping("/{id}/status")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<UserDTO>> updateStatus(
            @PathVariable Long id, @Valid @RequestBody UpdateUserStatusRequest request) {
        User updated = userService.updateUserActiveStatus(id, request.active());
        String message = Boolean.TRUE.equals(updated.getIsActive())
                ? "Account activated"
                : "Account deactivated";
        return ResponseEntity.ok(ApiResponse.success(message, UserDTO.from(updated)));
    }

    /** (Admin) Forces a fresh password for a user. */
    @PutMapping("/{id}/password")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ApiResponse<UserDTO>> resetPassword(
            @PathVariable Long id, @Valid @RequestBody ResetPasswordRequest request) {
        User updated = userService.resetUserPassword(id, request.newPassword());
        return ResponseEntity.ok(ApiResponse.success("Password reset", UserDTO.from(updated)));
    }
}
