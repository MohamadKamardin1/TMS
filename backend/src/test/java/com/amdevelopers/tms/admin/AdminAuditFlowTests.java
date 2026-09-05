package com.amdevelopers.tms.admin;

import static org.hamcrest.Matchers.hasItem;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
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
class AdminAuditFlowTests {

    private static final String ADMIN_PASSWORD = "123456";
    private static final String TAILOR_PASSWORD = "123456";
    private static final String REGISTER_PASSWORD = "Str0ng!Pass";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void admin_user_management_enforces_role_and_locks_out_low_roles() throws Exception {
        String adminToken = login("admin@gmail.com", ADMIN_PASSWORD);
        long adminId = meId(adminToken);

        // Non-admins cannot read the roster or the audit trail.
        String tailorToken = login("tailor@gmail.com", TAILOR_PASSWORD);
        mockMvc.perform(get("/api/users").header("Authorization", bearer(tailorToken)))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/audit-logs").header("Authorization", bearer(tailorToken)))
                .andExpect(status().isForbidden());

        // Fresh CUSTOMER whose role the admin will reassign.
        String customerUsername = uniqueUsername();
        String customerToken = register(customerUsername);
        long userId = meId(customerToken);
        mockMvc.perform(get("/api/customers/me").header("Authorization", bearer(customerToken)))
                .andExpect(status().isOk());

        // The user list carries role/status/audit-friendly metadata.
        mockMvc.perform(get("/api/users").header("Authorization", bearer(adminToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[?(@.id == %d)].role", userId).value(hasItem("CUSTOMER")))
                .andExpect(jsonPath("$.data[0].createdAt").exists())
                .andExpect(jsonPath("$.data[0].active").isBoolean());

        // Promote the customer to TAILOR.
        mockMvc.perform(patch("/api/users/{id}/role", userId)
                        .header("Authorization", bearer(adminToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"role":"TAILOR"}"""))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.role").value("TAILOR"));

        // The change is effective immediately, even for the already-issued token.
        mockMvc.perform(get("/api/customers/me").header("Authorization", bearer(customerToken)))
                .andExpect(status().isForbidden());
        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"username":"%s","password":"%s"}""".formatted(customerUsername, REGISTER_PASSWORD)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.role").value("TAILOR"));

        // The acting admin cannot demote themselves.
        mockMvc.perform(patch("/api/users/{id}/role", adminId)
                        .header("Authorization", bearer(adminToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"role":"CUSTOMER"}"""))
                .andExpect(status().isBadRequest());
    }

    @Test
    void deactivation_blocks_login_and_revokes_live_tokens() throws Exception {
        String adminToken = login("admin@gmail.com", ADMIN_PASSWORD);
        long adminId = meId(adminToken);

        String username = uniqueUsername();
        String userToken = register(username);
        long userId = meId(userToken);
        mockMvc.perform(patch("/api/users/{id}/role", userId)
                        .header("Authorization", bearer(adminToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"role":"TAILOR"}"""))
                .andExpect(status().isOk());

        // A tailor-scoped token that is valid right up until deactivation.
        mockMvc.perform(get("/api/orders").header("Authorization", bearer(userToken)))
                .andExpect(status().isOk());

        mockMvc.perform(patch("/api/users/{id}/status", userId)
                        .header("Authorization", bearer(adminToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"active":false}"""))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.active").value(false));

        // New logins are refused with a clear message ...
        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"username":"%s","password":"%s"}""".formatted(username, REGISTER_PASSWORD)))
                .andExpect(status().isForbidden());

        // ... and the previously valid token is revoked at the filter.
        mockMvc.perform(get("/api/orders").header("Authorization", bearer(userToken)))
                .andExpect(status().isUnauthorized());

        // The admin cannot deactivate themselves (lockout guard).
        mockMvc.perform(patch("/api/users/{id}/status", adminId)
                        .header("Authorization", bearer(adminToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"active":false}"""))
                .andExpect(status().isBadRequest());

        // Reactivation restores access immediately.
        mockMvc.perform(patch("/api/users/{id}/status", userId)
                        .header("Authorization", bearer(adminToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"active":true}"""))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.active").value(true));
        mockMvc.perform(get("/api/orders").header("Authorization", bearer(userToken)))
                .andExpect(status().isOk());
    }

    @Test
    void admin_actions_are_audited_and_password_reset_rotates_credentials() throws Exception {
        String adminToken = login("admin@gmail.com", ADMIN_PASSWORD);

        String username = uniqueUsername();
        String userToken = register(username);
        long userId = meId(userToken);

        // Role change is captured in the audit trail.
        mockMvc.perform(patch("/api/users/{id}/role", userId)
                        .header("Authorization", bearer(adminToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"role":"CASHIER"}"""))
                .andExpect(status().isOk());

        JsonNode roleAudit = findAuditEntry(adminToken, "USER_ROLE_CHANGED", userId);
        org.junit.jupiter.api.Assertions.assertEquals("CUSTOMER", roleAudit.path("oldValues").path("role").asText());
        org.junit.jupiter.api.Assertions.assertEquals("CASHIER", roleAudit.path("newValues").path("role").asText());
        org.junit.jupiter.api.Assertions.assertEquals("Admin User", roleAudit.path("actorName").asText());

        // Reset the password; the old one stops working, the new one signs in.
        mockMvc.perform(put("/api/users/{id}/password", userId)
                        .header("Authorization", bearer(adminToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"newPassword":"NewPass#987"}"""))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"username":"%s","password":"%s"}""".formatted(username, REGISTER_PASSWORD)))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"username":"%s","password":"%s"}""".formatted(username, "NewPass#987")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.role").value("CASHIER"));

        JsonNode resetAudit = findAuditEntry(adminToken, "USER_PASSWORD_RESET", userId);
        org.junit.jupiter.api.Assertions.assertTrue(resetAudit.path("newValues").path("passwordReset").asBoolean());
        // No secret ever lands in the audit payload.
        org.junit.jupiter.api.Assertions.assertTrue(resetAudit.path("oldValues").isMissingNode()
                || resetAudit.path("oldValues").isNull());
    }

    @Test
    void estimation_and_assignment_leave_an_order_audit_trail() throws Exception {
        String adminToken = login("admin@gmail.com", ADMIN_PASSWORD);

        String customerToken = register(uniqueUsername());
        long orderId = createOrder(customerToken);

        String tailorToken = login("tailor@gmail.com", TAILOR_PASSWORD);
        long tailorUserId = meId(tailorToken);
        mockMvc.perform(post("/api/orders/{id}/assign-tailor", orderId)
                        .header("Authorization", bearer(adminToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"tailorId":%d}""".formatted(tailorUserId)))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/orders/{id}/estimation", orderId)
                        .header("Authorization", bearer(tailorToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"estimatedPrice":2000.0,"estimatedCompletionDate":"2026-12-10"}"""))
                .andExpect(status().isOk());

        // Tailor assignment captured with the prior (empty) and new tailor.
        JsonNode assignAudit = findAuditEntry(adminToken, "ORDER_TAILOR_ASSIGNED", orderId);
        org.junit.jupiter.api.Assertions.assertEquals("Tailor Worker", assignAudit.path("newValues").path("tailor").asText());

        // The estimation shows the full before/after: old status + price set.
        JsonNode estimateAudit = findAuditEntry(adminToken, "ORDER_ESTIMATED", orderId);
        org.junit.jupiter.api.Assertions.assertEquals("PENDING_REVIEW", estimateAudit.path("oldValues").path("status").asText());
        org.junit.jupiter.api.Assertions.assertEquals("2000.00", estimateAudit.path("newValues").path("estimatedPrice").asText());
        org.junit.jupiter.api.Assertions.assertEquals("ESTIMATED", estimateAudit.path("newValues").path("status").asText());
        org.junit.jupiter.api.Assertions.assertEquals("Tailor Worker", estimateAudit.path("actorName").asText());
    }

    // ---------------- Helpers ----------------

    private JsonNode findAuditEntry(String token, String action, long entityId) throws Exception {
        MvcResult result = mockMvc.perform(get("/api/audit-logs")
                        .param("action", action)
                        .header("Authorization", bearer(token)))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode data = readData(result);
        for (JsonNode node : data) {
            if (node.path("entityId").asLong() == entityId && action.equals(node.path("action").asText())) {
                return node;
            }
        }
        throw new AssertionError("No audit entry found for action " + action + " entity " + entityId);
    }

    private long createOrder(String customerToken) throws Exception {
        MvcResult result = mockMvc.perform(multipart("/api/orders")
                        .param("title", "Admin audit order")
                        .header("Authorization", bearer(customerToken)))
                .andExpect(status().isCreated())
                .andReturn();
        return idFrom(result);
    }

    private String uniqueUsername() {
        return "admin_" + Long.toHexString(System.nanoTime());
    }

    private String register(String username) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"username":"%s","password":"%s","fullName":"Admin Flow Tester",
                                 "email":"%s@example.com"}""".formatted(
                                username, REGISTER_PASSWORD, username)))
                .andExpect(status().isCreated())
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

    private long meId(String token) throws Exception {
        MvcResult result = mockMvc.perform(get("/api/users/me").header("Authorization", bearer(token)))
                .andExpect(status().isOk())
                .andReturn();
        return idFrom(result);
    }

    private long idFrom(MvcResult result) throws Exception {
        return readData(result).path("id").asLong();
    }

    private String tokenFrom(MvcResult result) throws Exception {
        return readData(result).path("token").asText();
    }

    private JsonNode readData(MvcResult result) throws Exception {
        JsonNode body = objectMapper.readTree(result.getResponse().getContentAsString());
        return body.path("data");
    }

    private static String bearer(String token) {
        return "Bearer " + token;
    }
}
