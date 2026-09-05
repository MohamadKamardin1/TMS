package com.amdevelopers.tms.orders;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
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
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class OrderFlowTests {

    private static final String TAILOR_PASSWORD = "tailor123";
    private static final String ADMIN_PASSWORD = "admin123";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void customer_creates_order_admin_assigns_tailor_tailor_estimates() throws Exception {
        String customerToken = register(uniqueUsername());

        MvcResult createResult = mockMvc.perform(multipart("/api/orders")
                        .file(new MockMultipartFile("referenceImage",
                                "reference.png", "image/png", new byte[]{1, 2, 3}))
                        .param("title", "Wedding Sherwani")
                        .param("description", "Black sherwani with white embroidery")
                        .param("requiredCompletionDate", "2026-12-31")
                        .header("Authorization", bearer(customerToken)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.status").value("PENDING_REVIEW"))
                .andExpect(jsonPath("$.data.attachments[0].fileName").value("reference.png"))
                .andReturn();
        long orderId = idFrom(createResult);

        // Customer sees exactly their own order
        mockMvc.perform(get("/api/orders").header("Authorization", bearer(customerToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.length()").value(1));

        // A non-tailor may not submit an estimation
        mockMvc.perform(post("/api/orders/{id}/estimation", orderId)
                        .header("Authorization", bearer(customerToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(estimationBody()))
                .andExpect(status().isForbidden());

        // Another customer may not view this order
        String otherCustomerToken = register(uniqueUsername());
        mockMvc.perform(get("/api/orders/{id}", orderId)
                        .header("Authorization", bearer(otherCustomerToken)))
                .andExpect(status().isForbidden());

        // Admin assigns the tailor
        String adminToken = login("admin", ADMIN_PASSWORD);
        long tailorId = userIdOf(login("tailor1", TAILOR_PASSWORD));

        mockMvc.perform(post("/api/orders/{id}/assign-tailor", orderId)
                        .header("Authorization", bearer(adminToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"tailorId":%d}""".formatted(tailorId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.tailorName").value("Demo Tailor"))
                .andExpect(jsonPath("$.data.status").value("PENDING_REVIEW"));

        // The assigned tailor submits the estimation
        String tailorToken = login("tailor1", TAILOR_PASSWORD);
        mockMvc.perform(post("/api/orders/{id}/estimation", orderId)
                        .header("Authorization", bearer(tailorToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"estimatedPrice":5000.0,"estimatedCompletionDate":"2026-12-15",
                                 "termsAndPolicy":"Half payment upfront, balance on delivery"}"""))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("ESTIMATED"))
                .andExpect(jsonPath("$.data.estimatedPrice").value(5000.0));

        // Admin can filter by status and sees the order
        mockMvc.perform(get("/api/orders").param("status", "ESTIMATED")
                        .header("Authorization", bearer(adminToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[?(@.id == %d)]", orderId).exists());

        // Tailor list contains the order assigned to them
        mockMvc.perform(get("/api/orders").header("Authorization", bearer(tailorToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[?(@.id == %d)]", orderId).exists());
    }

    @Test
    void tailor_cannot_estimate_an_order_not_assigned_to_them() throws Exception {
        String customerToken = register(uniqueUsername());
        long orderId = idFrom(mockMvc.perform(multipart("/api/orders")
                        .param("title", "Kameez")
                        .header("Authorization", bearer(customerToken)))
                .andExpect(status().isCreated())
                .andReturn());

        String tailorToken = login("tailor1", TAILOR_PASSWORD);
        mockMvc.perform(post("/api/orders/{id}/estimation", orderId)
                        .header("Authorization", bearer(tailorToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(estimationBody()))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.message").value("This order is not assigned to you"));
    }

    @Test
    void non_image_upload_is_rejected() throws Exception {
        String customerToken = register(uniqueUsername());

        mockMvc.perform(multipart("/api/orders")
                        .file(new MockMultipartFile("referenceImage",
                                "notes.txt", "text/plain", "hello".getBytes()))
                        .param("title", "Shalwar Kameez")
                        .header("Authorization", bearer(customerToken)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Only image uploads are allowed"));
    }

    private static String estimationBody() {
        return """
                {"estimatedPrice":2000.0,"estimatedCompletionDate":"2026-12-10"}""";
    }

    private String uniqueUsername() {
        return "customer_" + Long.toHexString(System.nanoTime());
    }

    private static String bearer(String token) {
        return "Bearer " + token;
    }

    private String register(String username) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"username":"%s","password":"Str0ng!Pass","fullName":"Order Tester",
                                 "email":"%s@example.com"}""".formatted(username, username)))
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

    private long idFrom(MvcResult result) throws Exception {
        JsonNode body = objectMapper.readTree(result.getResponse().getContentAsString());
        return body.path("data").path("id").asLong();
    }

    private long userIdOf(String token) throws Exception {
        MvcResult result = mockMvc.perform(get("/api/users/me").header("Authorization", bearer(token)))
                .andExpect(status().isOk())
                .andReturn();
        return idFrom(result);
    }

    private String tokenFrom(MvcResult result) throws Exception {
        JsonNode body = objectMapper.readTree(result.getResponse().getContentAsString());
        return body.path("data").path("token").asText();
    }
}