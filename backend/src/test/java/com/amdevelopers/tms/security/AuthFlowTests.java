package com.amdevelopers.tms.security;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AuthFlowTests {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void register_login_and_access_own_customer_profile() throws Exception {
        String username = uniqueUsername();
        String token = register(username);

        mockMvc.perform(get("/api/users/me").header("Authorization", bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.username").value(username))
                .andExpect(jsonPath("$.data.role").value("CUSTOMER"));

        mockMvc.perform(get("/api/customers/me").header("Authorization", bearer(token)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.username").value(username))
                .andExpect(jsonPath("$.data.id").isNumber());

        mockMvc.perform(put("/api/customers/me/measurements")
                        .header("Authorization", bearer(token))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"address":"Lahore","lambai":"36","chest":"40","frontPocketSize":2}"""))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.address").value("Lahore"))
                .andExpect(jsonPath("$.data.lambai").value("36"))
                .andExpect(jsonPath("$.data.frontPocketSize").value(2));

        // Duplicate username must be rejected with 409
        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(registerBody(username)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.success").value(false));
    }

    @Test
    void protected_endpoints_reject_missing_and_invalid_tokens() throws Exception {
        mockMvc.perform(get("/api/users/me"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.success").value(false));

        mockMvc.perform(get("/api/users/me").header("Authorization", "Bearer not.a.jwt"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void login_with_wrong_password_is_rejected() throws Exception {
        register(uniqueUsername());
        String wrongPassword = "WrongPass123!";

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"username":"admin","password":"%s"}""".formatted(wrongPassword)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("Invalid username or password"));
    }

    @Test
    void customer_cannot_update_another_customers_profile_but_admin_can() throws Exception {
        String owner = uniqueUsername();
        String other = uniqueUsername();
        long otherProfileId = profileIdOf(register(other));
        String ownerToken = register(owner);

        mockMvc.perform(put("/api/customers/{id}/measurements", otherProfileId)
                        .header("Authorization", bearer(ownerToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"lambai":"99"}"""))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.success").value(false));

        String adminToken = login("admin@gmail.com", "123456");
        mockMvc.perform(put("/api/customers/{id}/measurements", otherProfileId)
                        .header("Authorization", bearer(adminToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"lambai":"99"}"""))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.lambai").value("99"));
    }

    private String uniqueUsername() {
        return "customer_" + Long.toHexString(System.nanoTime());
    }

    private static String registerBody(String username) {
        return """
                {"username":"%s","password":"Str0ng!Pass","fullName":"Test Customer",
                 "email":"%s@example.com"}""".formatted(username, username);
    }

    private static String bearer(String token) {
        return "Bearer " + token;
    }

    private String register(String username) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(registerBody(username)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.role").value("CUSTOMER"))
                .andReturn();
        return tokenFrom(result);
    }

    private String login(String username, String password) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"username":"%s","password":"%s"}""".formatted(username, password)))
                .andExpect(status().isOk())
                .andReturn();
        return tokenFrom(result);
    }

    private long profileIdOf(String token) throws Exception {
        MvcResult result = mockMvc.perform(get("/api/customers/me").header("Authorization", bearer(token)))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode body = objectMapper.readTree(result.getResponse().getContentAsString());
        return body.path("data").path("id").asLong();
    }

    private String tokenFrom(MvcResult result) throws Exception {
        JsonNode body = objectMapper.readTree(result.getResponse().getContentAsString());
        return body.path("data").path("token").asText();
    }
}