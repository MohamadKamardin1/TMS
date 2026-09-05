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
 * Initial-data bootstrap: seeds the five demo accounts used to drive the full
 * order workflow. Each account is created only if its email is not already
 * present, so seeding is idempotent and never overwrites existing data.
 *
 * <p>The login identifier is the email address itself (the username column
 * stores the email), which is exactly what the UI shows on the sign-in screen.
 * All passwords are BCrypt-hashed via {@link PasswordEncoder}.
 *
 * <p>Every credential is overridable through {@code app.seed.*} properties /
 * environment variables.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class DataSeeder implements CommandLineRunner {

    private final UserRepository userRepository;
    private final CustomerProfileRepository customerProfileRepository;
    private final PasswordEncoder passwordEncoder;

    @Value("${app.seed.admin-email}")
    private String adminEmail;

    @Value("${app.seed.admin-password}")
    private String adminPassword;

    @Value("${app.seed.admin-full-name}")
    private String adminFullName;

    @Value("${app.seed.tailor-email}")
    private String tailorEmail;

    @Value("${app.seed.tailor-password}")
    private String tailorPassword;

    @Value("${app.seed.tailor-full-name}")
    private String tailorFullName;

    @Value("${app.seed.cashier-email}")
    private String cashierEmail;

    @Value("${app.seed.cashier-password}")
    private String cashierPassword;

    @Value("${app.seed.cashier-full-name}")
    private String cashierFullName;

    @Value("${app.seed.delivery-email}")
    private String deliveryEmail;

    @Value("${app.seed.delivery-password}")
    private String deliveryPassword;

    @Value("${app.seed.delivery-full-name}")
    private String deliveryFullName;

    @Value("${app.seed.customer-email}")
    private String customerEmail;

    @Value("${app.seed.customer-password}")
    private String customerPassword;

    @Value("${app.seed.customer-full-name}")
    private String customerFullName;

    @Override
    @Transactional
    public void run(String... args) {
        createUserIfMissing(adminEmail, adminPassword, adminFullName, Role.ADMIN);
        createUserIfMissing(tailorEmail, tailorPassword, tailorFullName, Role.TAILOR);
        createUserIfMissing(cashierEmail, cashierPassword, cashierFullName, Role.CASHIER);
        createUserIfMissing(deliveryEmail, deliveryPassword, deliveryFullName, Role.DELIVERY);

        User customer = createUserIfMissing(
                customerEmail, customerPassword, customerFullName, Role.CUSTOMER);
        if (customer != null) {
            customerProfileRepository.save(CustomerProfile.builder().user(customer).build());
        }

        log.info("Seed accounts checked: {}, {}, {}, {}, {}",
                adminEmail, tailorEmail, cashierEmail, deliveryEmail, customerEmail);
    }

    /**
     * Creates the account when its email is not yet present. The username
     * column stores the email so the sign-in form's identifier matches the
     * email address used in the UI. Returns {@code null} when the account
     * already exists (or was skipped).
     */
    private User createUserIfMissing(String email, String password,
                                     String fullName, Role role) {
        if (userRepository.existsByEmail(email)) {
            log.info("Seeded account already exists, skipping: {}", email);
            return null;
        }

        User user = userRepository.save(User.builder()
                .username(email)
                .password(passwordEncoder.encode(password))
                .fullName(fullName)
                .email(email)
                .role(role)
                .isActive(true)
                .build());
        log.info("Seeded {} user: {}", role, email);
        return user;
    }
}