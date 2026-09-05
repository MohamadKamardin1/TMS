package com.amdevelopers.tms.config;

import com.amdevelopers.tms.entity.CustomerProfile;
import com.amdevelopers.tms.entity.User;
import com.amdevelopers.tms.enums.Role;
import com.amdevelopers.tms.repositories.CustomerProfileRepository;
import com.amdevelopers.tms.repositories.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Initial-data bootstrap: on a fresh (empty) database creates the accounts
 * needed to drive the full order workflow before any staff-management UI
 * exists. All passwords are BCrypt-hashed via {@link PasswordEncoder}.
 *
 * The customer account also gets an empty {@link CustomerProfile}, otherwise
 * customer-scoped endpoints would fail on their first login.
 *
 * Every credential is overridable through {@code app.seed.*} properties /
 * environment variables.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class DataSeeder implements CommandLineRunner {

    private final UserRepository userRepository;
    private final CustomerProfileRepository customerProfileRepository;
    private final PasswordEncoder passwordEncoder;

    @Value("${app.seed.admin-username}")
    private String adminUsername;

    @Value("${app.seed.admin-email}")
    private String adminEmail;

    @Value("${app.seed.admin-password}")
    private String adminPassword;

    @Value("${app.seed.tailor-username}")
    private String tailorUsername;

    @Value("${app.seed.tailor-email}")
    private String tailorEmail;

    @Value("${app.seed.tailor-password}")
    private String tailorPassword;

    @Value("${app.seed.cashier-username}")
    private String cashierUsername;

    @Value("${app.seed.cashier-email}")
    private String cashierEmail;

    @Value("${app.seed.cashier-password}")
    private String cashierPassword;

    @Value("${app.seed.delivery-username}")
    private String deliveryUsername;

    @Value("${app.seed.delivery-email}")
    private String deliveryEmail;

    @Value("${app.seed.delivery-password}")
    private String deliveryPassword;

    @Value("${app.seed.customer-username}")
    private String customerUsername;

    @Value("${app.seed.customer-email}")
    private String customerEmail;

    @Value("${app.seed.customer-password}")
    private String customerPassword;

    @Override
    @Transactional
    public void run(String... args) {
        if (userRepository.count() > 0) {
            log.info("Database already contains users; skipping initial data seeding.");
            return;
        }

        createUser(adminUsername, adminEmail, adminPassword, "System Administrator", Role.ADMIN);
        createUser(tailorUsername, tailorEmail, tailorPassword, "Demo Tailor", Role.TAILOR);
        createUser(cashierUsername, cashierEmail, cashierPassword, "Demo Cashier", Role.CASHIER);
        createUser(deliveryUsername, deliveryEmail, deliveryPassword, "Demo Delivery", Role.DELIVERY);

        User customer = createUser(customerUsername, customerEmail, customerPassword, "Demo Customer", Role.CUSTOMER);
        customerProfileRepository.save(CustomerProfile.builder().user(customer).build());

        log.info("Seeded initial users: {}, {}, {}, {}, {}",
                adminUsername, tailorUsername, cashierUsername, deliveryUsername, customerUsername);
    }

    private User createUser(String username, String email, String password,
                            String fullName, Role role) {
        User user = userRepository.save(User.builder()
                .username(username)
                .password(passwordEncoder.encode(password))
                .fullName(fullName)
                .email(email)
                .role(role)
                .isActive(true)
                .build());
        log.info("Seeded {} user: {}", role, username);
        return user;
    }
}