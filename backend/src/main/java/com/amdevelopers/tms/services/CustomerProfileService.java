package com.amdevelopers.tms.services;

import com.amdevelopers.tms.dto.CustomerProfileDTO;
import com.amdevelopers.tms.entity.CustomerProfile;
import com.amdevelopers.tms.entity.User;
import com.amdevelopers.tms.enums.Role;
import com.amdevelopers.tms.exceptions.ResourceNotFoundException;
import com.amdevelopers.tms.repositories.CustomerProfileRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class CustomerProfileService {

    private final CustomerProfileRepository customerProfileRepository;
    private final UserService userService;

    /**
     * Profile of the user currently logged in (safe to call for ADMIN too,
     * though only users with an actual {@code customer_profiles} row get a result).
     */
    @Transactional(readOnly = true)
    public CustomerProfileDTO getCurrentProfile() {
        return CustomerProfileDTO.from(getProfileForCurrentUser());
    }

    /**
     * Entity-level accessor for the current user's {@link CustomerProfile},
     * used by order flows that need to link a profile. Stays managed within
     * the caller's transaction.
     */
    @Transactional(readOnly = true)
    public CustomerProfile getCurrentCustomerProfile() {
        return getProfileForCurrentUser();
    }

    @Transactional
    public CustomerProfileDTO updateCurrentMeasurements(CustomerProfileDTO dto) {
        return CustomerProfileDTO.from(apply(dto, getProfileForCurrentUser()));
    }

    /**
     * Updates the measurements of the given profile. Non-admin callers may only
     * modify their own record; ADMIN may modify any profile.
     */
    @Transactional
    public CustomerProfileDTO updateMeasurements(Long customerProfileId, CustomerProfileDTO dto) {
        CustomerProfile profile = customerProfileRepository.findById(customerProfileId)
                .orElseThrow(() -> new ResourceNotFoundException("Customer profile not found: " + customerProfileId));

        User currentUser = userService.getCurrentUser();
        boolean isAdmin = currentUser.getRole() == Role.ADMIN;
        boolean isOwner = profile.getUser() != null && profile.getUser().getId().equals(currentUser.getId());
        if (!isAdmin && !isOwner) {
            throw new AccessDeniedException("You can only update your own measurements");
        }

        return CustomerProfileDTO.from(apply(dto, profile));
    }

    private CustomerProfile getProfileForCurrentUser() {
        User currentUser = userService.getCurrentUser();
        return customerProfileRepository.findByUser(currentUser)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "No customer profile found for user: " + currentUser.getUsername()));
    }

    private CustomerProfile apply(CustomerProfileDTO dto, CustomerProfile profile) {
        profile.setAddress(dto.address());
        profile.setCnic(dto.cnic());
        profile.setLambai(dto.lambai());
        profile.setAsteen(dto.asteen());
        profile.setTeera(dto.teera());
        profile.setChest(dto.chest());
        profile.setCollarBanSize(dto.collarBanSize());
        profile.setCollarBanWidth(dto.collarBanWidth());
        profile.setKhulla(dto.khulla());
        profile.setShalwar(dto.shalwar());
        profile.setPanja(dto.panja());
        profile.setDaman(dto.daman());
        profile.setFrontPocketSize(dto.frontPocketSize());
        profile.setSidePockets(dto.sidePockets());
        profile.setFrontPati(dto.frontPati());
        profile.setKaaf(dto.kaaf());
        profile.setShalwarPocket(dto.shalwarPocket());
        return customerProfileRepository.save(profile);
    }
}