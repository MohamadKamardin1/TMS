package com.amdevelopers.tms.services;

import com.amdevelopers.tms.dto.UserRegisterDTO;
import com.amdevelopers.tms.entity.CustomerProfile;
import com.amdevelopers.tms.entity.User;
import com.amdevelopers.tms.enums.Role;
import com.amdevelopers.tms.exceptions.ConflictException;
import com.amdevelopers.tms.exceptions.ResourceNotFoundException;
import com.amdevelopers.tms.repositories.CustomerProfileRepository;
import com.amdevelopers.tms.repositories.UserRepository;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class UserService {

    private final UserRepository userRepository;
    private final CustomerProfileRepository customerProfileRepository;
    private final PasswordEncoder passwordEncoder;

    /**
     * Creates a CUSTOMER account with a BCrypt-hashed password together with an
     * empty {@link CustomerProfile} so the new user can immediately use the
     * customer endpoints.
     */
    @Transactional
    public User register(UserRegisterDTO dto) {
        if (userRepository.existsByUsername(dto.username())) {
            throw new ConflictException("Username is already taken");
        }
        if (userRepository.existsByEmail(dto.email())) {
            throw new ConflictException("Email is already registered");
        }

        User user = User.builder()
                .username(dto.username())
                .password(passwordEncoder.encode(dto.password()))
                .fullName(dto.fullName())
                .email(dto.email())
                .phone(dto.phone())
                .role(Role.CUSTOMER)
                .isActive(true)
                .build();
        userRepository.save(user);

        customerProfileRepository.save(CustomerProfile.builder().user(user).build());

        return user;
    }

    /**
     * Resolves the authenticated user from the JWT principal (SecurityContext).
     */
    public User getCurrentUser() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()) {
            throw new ResourceNotFoundException("No authenticated user in the current context");
        }
        return getUserByUsername(authentication.getName());
    }

    public User getUserByUsername(String username) {
        return userRepository.findByUsername(username)
                .orElseThrow(() -> new ResourceNotFoundException("User not found: " + username));
    }

    /**
     * Returns staff users, optionally filtered by role (e.g. TAILOR or
     * DELIVERY). Used by the admin UI to populate assignment dropdowns.
     */
    @Transactional(readOnly = true)
    public List<User> listUsersByRole(Role role) {
        return role == null ? userRepository.findAll() : userRepository.findByRole(role);
    }
}