package com.amdevelopers.tms.enums;

public enum Role {
    CUSTOMER,
    TAILOR,
    CASHIER,
    DELIVERY,
    ADMIN;

    public String getAuthority() {
        return "ROLE_" + name();
    }
}