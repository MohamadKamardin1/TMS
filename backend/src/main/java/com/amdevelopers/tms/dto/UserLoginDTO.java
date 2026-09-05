package com.amdevelopers.tms.dto;

import jakarta.validation.constraints.NotBlank;

public record UserLoginDTO(
        @NotBlank(message = "Username is required") String username,
        @NotBlank(message = "Password is required") String password) {
}