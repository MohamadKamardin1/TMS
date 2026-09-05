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

    private static final String TAILOR_PASSWORD = "123456";
    private static final String ADMIN_PASSWORD = "123456";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void customer_creates_order_admin_assigns_tailor_tailor_estimates() throws Exception {
        String customerToken = register(uniqueUsername());

        MvcResult createResult = mockMvc.perform(multipart("/api/orders")
                        .file(new MockMultipartFile("referenceImages",
                                "reference.png", "image/png", new byte[]{1, 2, 3}))
                        .file(new MockMultipartFile("referenceImages",
                                "embroidery.png", "image/png", new byte[]{4, 5, 6}))
                        .param("title", "Wedding Sherwani")
                        .param("description", "Black sherwani with white embroidery")
                        .param("garmentType", "Sherwani")
                        .param("fabricType", "Velvet")
                        .param("styleDetails", "Embroidered collar, maroon inside lining")
                        .param("measurements", "{\"chest\":\"42\",\"waist\":\"36\",\"length\":\"50\"}")
                        .param("specialInstructions", "Deliver before the wedding week.")
                        .param("preferredDeliveryDate", "2026-12-31")
                        .header("Authorization", bearer(customerToken)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.status").value("PENDING_REVIEW"))
                .andExpect(jsonPath("$.data.garmentType").value("Sherwani"))
                .andExpect(jsonPath("$.data.fabricType").value("Velvet"))
                .andExpect(jsonPath("$.data.styleDetails").value("Embroidered collar, maroon inside lining"))
                .andExpect(jsonPath("$.data.measurements.chest").value("42"))
                .andExpect(jsonPath("$.data.measurements.waist").value("36"))
                .andExpect(jsonPath("$.data.measurements.length").value("50"))
                .andExpect(jsonPath("$.data.preferredDeliveryDate").value("2026-12-31"))
                .andExpect(jsonPath("$.data.specialInstructions").value("Deliver before the wedding week."))
                .andExpect(jsonPath("$.data.attachments.length()").value(2))
                .andExpect(jsonPath("$.data.attachments[0].fileName").value("reference.png"))
                .andExpect(jsonPath("$.data.attachments[1].fileName").value("embroidery.png"))
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
        String adminToken = login("admin@gmail.com", ADMIN_PASSWORD);
        long tailorId = userIdOf(login("tailor@gmail.com", TAILOR_PASSWORD));

        mockMvc.perform(post("/api/orders/{id}/assign-tailor", orderId)
                        .header("Authorization", bearer(adminToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"tailorId":%d}""".formatted(tailorId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.tailorName").value("Tailor Worker"))
                .andExpect(jsonPath("$.data.status").value("PENDING_REVIEW"));

        // The assigned tailor submits the estimation
        String tailorToken = login("tailor@gmail.com", TAILOR_PASSWORD);
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

        String tailorToken = login("tailor@gmail.com", TAILOR_PASSWORD);
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
                        .file(new MockMultipartFile("referenceImages",
                                "notes.txt", "text/plain", "hello".getBytes()))
                        .param("title", "Shalwar Kameez")
                        .header("Authorization", bearer(customerToken)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Only image uploads are allowed"));
    }

    @Test
    void measurements_must_be_a_json_object() throws Exception {
        String customerToken = register(uniqueUsername());

        // An array is not a valid measurements object
        mockMvc.perform(multipart("/api/orders")
                        .param("title", "Bad Measurements")
                        .param("measurements", "[1,2,3]")
                        .header("Authorization", bearer(customerToken)))
                .andExpect(status().isBadRequest());

        // Plain, non-JSON text is rejected too
        mockMvc.perform(multipart("/api/orders")
                        .param("title", "Bad Measurements 2")
                        .param("measurements", "not-json")
                        .header("Authorization", bearer(customerToken)))
                .andExpect(status().isBadRequest());
    }

    @Test
    void tailor_cannot_estimate_an_order_already_estimated() throws Exception {
        String customerToken = register(uniqueUsername());
        long orderId = idFrom(mockMvc.perform(multipart("/api/orders")
                        .param("title", "Single Estimation Order")
                        .header("Authorization", bearer(customerToken)))
                .andExpect(status().isCreated())
                .andReturn());

        String adminToken = login("admin@gmail.com", ADMIN_PASSWORD);
        String tailorToken = login("tailor@gmail.com", TAILOR_PASSWORD);
        long tailorId = userIdOf(tailorToken);
        mockMvc.perform(post("/api/orders/{id}/assign-tailor", orderId)
                        .header("Authorization", bearer(adminToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"tailorId":%d}""".formatted(tailorId)))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/orders/{id}/estimation", orderId)
                        .header("Authorization", bearer(tailorToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(estimationBody()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("ESTIMATED"));

        // ESTIMATED is terminal for the estimation step — re-estimation is rejected
        mockMvc.perform(post("/api/orders/{id}/estimation", orderId)
                        .header("Authorization", bearer(tailorToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(estimationBody()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value(
                        "Only orders in PENDING_REVIEW can be estimated, current status: ESTIMATED"));
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