package com.amdevelopers.tms.dto;

import com.amdevelopers.tms.entity.User;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;

public record CustomerProfileDTO(
        Long id,
        Long userId,
        String username,
        String fullName,
        String email,
        String phone,

        @Size(max = 255, message = "Address must be at most 255 characters")
        String address,

        @Size(max = 20, message = "CNIC must be at most 20 characters")
        String cnic,

        @Size(max = 20) String lambai,
        @Size(max = 20) String asteen,
        @Size(max = 20) String teera,
        @Size(max = 20) String chest,
        @Size(max = 20) String collarBanSize,
        @Size(max = 20) String collarBanWidth,
        @Size(max = 20) String khulla,
        @Size(max = 20) String shalwar,
        @Size(max = 20) String panja,
        @Size(max = 20) String daman,

        @Min(value = 0, message = "Front pocket size must not be negative")
        @Max(value = 100, message = "Front pocket size must be at most 100")
        Integer frontPocketSize,

        @Min(value = 0, message = "Side pockets must not be negative")
        Integer sidePockets,

        Boolean frontPati,
        Boolean kaaf,
        Boolean shalwarPocket) {

    public static CustomerProfileDTO from(com.amdevelopers.tms.entity.CustomerProfile profile) {
        User user = profile.getUser();
        return new CustomerProfileDTO(
                profile.getId(),
                user != null ? user.getId() : null,
                user != null ? user.getUsername() : null,
                user != null ? user.getFullName() : null,
                user != null ? user.getEmail() : null,
                user != null ? user.getPhone() : null,
                profile.getAddress(),
                profile.getCnic(),
                profile.getLambai(),
                profile.getAsteen(),
                profile.getTeera(),
                profile.getChest(),
                profile.getCollarBanSize(),
                profile.getCollarBanWidth(),
                profile.getKhulla(),
                profile.getShalwar(),
                profile.getPanja(),
                profile.getDaman(),
                profile.getFrontPocketSize(),
                profile.getSidePockets(),
                profile.getFrontPati(),
                profile.getKaaf(),
                profile.getShalwarPocket());
    }
}