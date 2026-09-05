package com.amdevelopers.tms.controller;

import com.amdevelopers.tms.dto.ApiResponse;
import com.amdevelopers.tms.dto.AuthResponse;
import com.amdevelopers.tms.dto.UserLoginDTO;
import com.amdevelopers.tms.dto.UserRegisterDTO;
import com.amdevelopers.tms.entity.User;
import com.amdevelopers.tms.security.JwtService;
import com.amdevelopers.tms.services.UserService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthenticationManager authenticationManager;
    private final JwtService jwtService;
    private final UserService userService;

    @PostMapping("/login")
    public ResponseEntity<ApiResponse<AuthResponse>> login(@Valid @RequestBody UserLoginDTO request) {
        Authentication authentication = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(request.username(), request.password()));

        UserDetails userDetails = (UserDetails) authentication.getPrincipal();
        String token = jwtService.generateToken(userDetails);
        String role = authentication.getAuthorities().stream()
                .map(granted -> granted.getAuthority().replaceFirst("^ROLE_", ""))
                .findFirst()
                .orElse(null);

        return ResponseEntity.ok(ApiResponse.success("Login successful",
                AuthResponse.of(token, userDetails.getUsername(), role)));
    }

    @PostMapping("/register")
    public ResponseEntity<ApiResponse<AuthResponse>> register(@Valid @RequestBody UserRegisterDTO request) {
        User user = userService.register(request);
        String token = jwtService.generateToken(user.getUsername());

        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success("Account created successfully",
                        AuthResponse.of(token, user.getUsername(), user.getRole().name())));
    }
}