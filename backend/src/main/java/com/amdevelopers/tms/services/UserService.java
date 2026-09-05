package com.amdevelopers.tms.services;

import com.amdevelopers.tms.dto.UserRegisterDTO;
import com.amdevelopers.tms.entity.CustomerProfile;
import com.amdevelopers.tms.entity.User;
import com.amdevelopers.tms.enums.OrderStatus;
import com.amdevelopers.tms.enums.Role;
import com.amdevelopers.tms.exceptions.ConflictException;
import com.amdevelopers.tms.exceptions.ResourceNotFoundException;
import com.amdevelopers.tms.repositories.CustomerProfileRepository;
import com.amdevelopers.tms.repositories.OrderRepository;
import com.amdevelopers.tms.repositories.UserRepository;
import java.util.List;
import java.util.Map;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class UserService {

    /**
     * Order states in which the assigned tailor is still required. Used by the
     * admin guards so a tailor cannot be demoted/deactivated while work is live.
     */
    private static final Set<OrderStatus> TAILOR_ACTIVE_STATES = Set.of(
            OrderStatus.PENDING_REVIEW,
            OrderStatus.IN_PROGRESS,
            OrderStatus.READY_FOR_DELIVERY);

    /** Order states in which the assigned delivery agent is still required. */
    private static final Set<OrderStatus> DELIVERY_ACTIVE_STATES = Set.of(
            OrderStatus.OUT_FOR_DELIVERY);

    private final UserRepository userRepository;
    private final CustomerProfileRepository customerProfileRepository;
    private final PasswordEncoder passwordEncoder;
    private final OrderRepository orderRepository;
    private final AuditService auditService;

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

    // ---------------- Admin user management ----------------

    /**
     * Every account, newest first, with its role/status. Backing the admin
     * User Management screen.
     */
    @Transactional(readOnly = true)
    public List<User> getAllUsers() {
        return userRepository.findAllByOrderByCreatedAtDesc();
    }

    /**
     * (Admin) Reassigns a user's role. Several invariants keep the system
     * operable: an admin can never change their own role, the last ADMIN cannot
     * be demoted, and a tailor/delivery agent cannot be moved off their role
     * while orders still depend on them. The change is audited.
     */
    @Transactional
    public User updateUserRole(Long userId, String roleName) {
        User target = requireUser(userId);
        Role newRole = parseRole(roleName);
        if (target.getRole() == newRole) {
            return target;
        }

        User actor = getCurrentUser();
        if (actor.getId().equals(target.getId())) {
            throw new IllegalArgumentException("You cannot change your own role");
        }
        if (newRole != Role.ADMIN && target.getRole() == Role.ADMIN
                && userRepository.countByRole(Role.ADMIN) <= 1) {
            throw new IllegalArgumentException("Cannot demote the only ADMIN account");
        }
        ensureNoStrandedWork(target, newRole);

        Map<String, Object> before = AuditService.userState(target);
        target.setRole(newRole);
        if (newRole == Role.CUSTOMER && !customerProfileRepository.existsByUser(target)) {
            customerProfileRepository.save(CustomerProfile.builder().user(target).build());
        }
        Map<String, Object> after = AuditService.userState(target);
        auditService.record(AuditService.Actions.USER_ROLE_CHANGED,
                AuditService.ENTITY_USER, target.getId(), before, after);
        return target;
    }

    /**
     * (Admin) Activates or deactivates an account. An account with live work
     * (or the sole ADMIN) cannot be deactivated, and an admin can never
     * deactivate themselves. Deactivation is immediately effective because the
     * JWT filter reloads account state from the database on every request.
     */
    @Transactional
    public User updateUserActiveStatus(Long userId, Boolean active) {
        User target = requireUser(userId);
        boolean currentlyActive = Boolean.TRUE.equals(target.getIsActive());
        boolean newActive = Boolean.TRUE.equals(active);
        if (currentlyActive == newActive) {
            return target;
        }

        if (!newActive) {
            User actor = getCurrentUser();
            if (actor.getId().equals(target.getId())) {
                throw new IllegalArgumentException("You cannot deactivate your own account");
            }
            if (target.getRole() == Role.ADMIN && userRepository.countByRole(Role.ADMIN) <= 1) {
                throw new IllegalArgumentException("Cannot deactivate the only ADMIN account");
            }
            ensureNoStrandedWork(target, null);
        }

        Map<String, Object> before = AuditService.userState(target);
        target.setIsActive(newActive);
        Map<String, Object> after = AuditService.userState(target);
        auditService.record(AuditService.Actions.USER_STATUS_CHANGED,
                AuditService.ENTITY_USER, target.getId(), before, after);
        return target;
    }

    /**
     * (Admin) Sets a fresh password. Never recorded in the audit trail (only the
     * fact that a reset happened is). Requires the same strength policy as
     * registration.
     */
    @Transactional
    public User resetUserPassword(Long userId, String newPassword) {
        User target = requireUser(userId);
        target.setPassword(passwordEncoder.encode(newPassword));
        auditService.record(AuditService.Actions.USER_PASSWORD_RESET,
                AuditService.ENTITY_USER, target.getId(), null,
                Map.of("passwordReset", true));
        return target;
    }

    private User requireUser(Long userId) {
        return userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("User not found: " + userId));
    }

    private static Role parseRole(String roleName) {
        if (roleName == null || roleName.isBlank()) {
            throw new IllegalArgumentException("Role is required");
        }
        try {
            return Role.valueOf(roleName.trim().toUpperCase());
        } catch (IllegalArgumentException ex) {
            throw new IllegalArgumentException("Unknown role: " + roleName);
        }
    }

    /**
     * Prevents a role move (or, with a {@code null} target, a deactivation) that
     * would leave orders in a state no assigned staff member can advance.
     */
    private void ensureNoStrandedWork(User target, Role newRole) {
        boolean leavingTailor = target.getRole() == Role.TAILOR && newRole != Role.TAILOR;
        boolean leavingDelivery = target.getRole() == Role.DELIVERY && newRole != Role.DELIVERY;

        if (leavingTailor) {
            long busy = orderRepository.countByTailor_IdAndStatusIn(
                    target.getId(), TAILOR_ACTIVE_STATES);
            if (busy > 0) {
                throw new IllegalArgumentException(
                        "Cannot remove this TAILOR from " + busy
                                + " active order(s). Finish or reassign them first.");
            }
        }
        if (leavingDelivery) {
            long busy = orderRepository.countByDeliveryAgent_IdAndStatusIn(
                    target.getId(), DELIVERY_ACTIVE_STATES);
            if (busy > 0) {
                throw new IllegalArgumentException(
                        "Cannot remove this DELIVERY agent from " + busy
                                + " order(s) currently out for delivery.");
            }
        }
    }
}
