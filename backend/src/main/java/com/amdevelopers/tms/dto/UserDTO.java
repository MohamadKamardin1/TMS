package com.amdevelopers.tms.dto;

import com.amdevelopers.tms.entity.User;

public record UserDTO(
        Long id,
        String username,
        String fullName,
        String email,
        String phone,
        String role,
        boolean active) {

    public static UserDTO from(User user) {
        return new UserDTO(
                user.getId(),
                user.getUsername(),
                user.getFullName(),
                user.getEmail(),
                user.getPhone(),
                user.getRole() != null ? user.getRole().name() : null,
                Boolean.TRUE.equals(user.getIsActive()));
    }
}