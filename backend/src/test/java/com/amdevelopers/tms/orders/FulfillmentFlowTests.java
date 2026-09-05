package com.amdevelopers.tms.orders;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
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
class FulfillmentFlowTests {

    private static final String ADMIN_PASSWORD = "123456";
    private static final String TAILOR_PASSWORD = "123456";
    private static final String CASHIER_PASSWORD = "123456";
    private static final String DELIVERY_PASSWORD = "123456";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void tailor_delivery_customer_full_workflow() throws Exception {
        String customerToken = register(uniqueUsername());
        long orderId = toPaid(customerToken);
        String tailorToken = login("tailor@gmail.com", TAILOR_PASSWORD);
        String adminToken = login("admin@gmail.com", ADMIN_PASSWORD);
        String deliveryToken = login("delivery@gmail.com", DELIVERY_PASSWORD);

        // Tailor must first start production before the order can be marked ready
        mockMvc.perform(post("/api/orders/{id}/ready-for-delivery", orderId)
                        .header("Authorization", bearer(tailorToken)))
                .andExpect(status().isConflict());

        mockMvc.perform(post("/api/orders/{id}/start-production", orderId)
                        .header("Authorization", bearer(tailorToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("IN_PROGRESS"));

        mockMvc.perform(post("/api/orders/{id}/ready-for-delivery", orderId)
                        .header("Authorization", bearer(tailorToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("READY_FOR_DELIVERY"));

        // Already READY_FOR_DELIVERY -> starting production again is rejected
        mockMvc.perform(post("/api/orders/{id}/start-production", orderId)
                        .header("Authorization", bearer(tailorToken)))
                .andExpect(status().isConflict());

        long deliveryId = userId(deliveryToken);

        // Assigning a delivery agent keeps the garment READY_FOR_DELIVERY at the
        // shop — the run is dispatched only once the assigned agent marks it out.
        mockMvc.perform(post("/api/orders/{id}/assign-delivery", orderId)
                        .header("Authorization", bearer(adminToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"deliveryUserId":%d}""".formatted(deliveryId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("READY_FOR_DELIVERY"))
                .andExpect(jsonPath("$.data.deliveryName").value("Delivery Agent"));

        // Hand-over cannot be confirmed before the run has been dispatched.
        mockMvc.perform(post("/api/orders/{id}/confirm-delivery", orderId)
                        .header("Authorization", bearer(deliveryToken)))
                .andExpect(status().isConflict());

        // Only delivery staff may dispatch; only the assigned agent does so.
        mockMvc.perform(post("/api/orders/{id}/out-for-delivery", orderId)
                        .header("Authorization", bearer(customerToken)))
                .andExpect(status().isForbidden());

        mockMvc.perform(post("/api/orders/{id}/out-for-delivery", orderId)
                        .header("Authorization", bearer(deliveryToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("OUT_FOR_DELIVERY"));

        // Re-assigning while OUT_FOR_DELIVERY is allowed and keeps the status
        mockMvc.perform(post("/api/orders/{id}/assign-delivery", orderId)
                        .header("Authorization", bearer(adminToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"deliveryUserId":%d}""".formatted(deliveryId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("OUT_FOR_DELIVERY"));

        mockMvc.perform(post("/api/orders/{id}/confirm-delivery", orderId)
                        .header("Authorization", bearer(deliveryToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("DELIVERED"));

        // Delivered order is terminal; the admin status endpoint cannot rewind it
        mockMvc.perform(patch("/api/orders/{id}/status", orderId)
                        .header("Authorization", bearer(adminToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"status":"IN_PROGRESS"}"""))
                .andExpect(status().isConflict());

        mockMvc.perform(post("/api/feedback")
                        .header("Authorization", bearer(customerToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"orderId":%d,"rating":5,"comments":"Excellent work!"}
                                """.formatted(orderId)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.rating").value(5))
                .andExpect(jsonPath("$.data.comments").value("Excellent work!"));

        // The customer can read the submitted review back for this order.
        mockMvc.perform(get("/api/feedback/order/{orderId}", orderId)
                        .header("Authorization", bearer(customerToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.rating").value(5))
                .andExpect(jsonPath("$.data.comments").value("Excellent work!"));

        // Only one feedback per order
        mockMvc.perform(post("/api/feedback")
                        .header("Authorization", bearer(customerToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"orderId":%d,"rating":4,"comments":"Second attempt"}
                                """.formatted(orderId)))
                .andExpect(status().isConflict());
    }

    @Test
    void feedback_requires_delivered_order_and_ownership() throws Exception {
        String customerToken = register(uniqueUsername());
        long orderId = toPaid(customerToken);

        // Order is PAID but not delivered -> feedback rejected
        mockMvc.perform(post("/api/feedback")
                        .header("Authorization", bearer(customerToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"orderId":%d,"rating":5}""".formatted(orderId)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value(
                        "Feedback is only allowed after the order is DELIVERED, current status: PAID"));

        // A different customer cannot leave feedback on someone else's order
        String otherCustomerToken = register(uniqueUsername());
        mockMvc.perform(post("/api/feedback")
                        .header("Authorization", bearer(otherCustomerToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"orderId":%d,"rating":5}""".formatted(orderId)))
                .andExpect(status().isForbidden());
    }

    @Test
    void fulfillment_endpoints_respect_roles() throws Exception {
        String customerToken = register(uniqueUsername());
        long orderId = toPaid(customerToken);
        String tailorToken = login("tailor@gmail.com", TAILOR_PASSWORD);
        String deliveryToken = login("delivery@gmail.com", DELIVERY_PASSWORD);

        // Only tailors may start production
        mockMvc.perform(post("/api/orders/{id}/start-production", orderId)
                        .header("Authorization", bearer(customerToken)))
                .andExpect(status().isForbidden());

        // Only admin/cashier may assign delivery
        long deliveryId = userId(deliveryToken);
        mockMvc.perform(post("/api/orders/{id}/assign-delivery", orderId)
                        .header("Authorization", bearer(tailorToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"deliveryUserId":%d}""".formatted(deliveryId)))
                .andExpect(status().isForbidden());

        // Only the assigned DELIVERY agent may confirm hand-over
        mockMvc.perform(post("/api/orders/{id}/confirm-delivery", orderId)
                        .header("Authorization", bearer(tailorToken)))
                .andExpect(status().isForbidden());

        // Only CUSTOMERs may submit feedback
        mockMvc.perform(post("/api/feedback")
                        .header("Authorization", bearer(deliveryToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"orderId":%d,"rating":5}""".formatted(orderId)))
                .andExpect(status().isForbidden());
    }

    /**
     * Registers a fresh customer, then walks the order through estimation,
     * invoicing and payment so it reaches PAID. Returns the order id.
     */
    private long toPaid(String customerToken) throws Exception {
        long orderId = idFrom(mockMvc.perform(multipart("/api/orders")
                        .param("title", "Fulfillment Workflow Order")
                        .header("Authorization", bearer(customerToken)))
                .andExpect(status().isCreated())
                .andReturn());
        submitEstimation(orderId);

        String cashierToken = login("cashier@gmail.com", CASHIER_PASSWORD);
        long invoiceId = idFrom(mockMvc.perform(post("/api/invoices")
                        .param("orderId", String.valueOf(orderId))
                        .header("Authorization", bearer(cashierToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.status").value("DRAFT"))
                .andReturn());

        mockMvc.perform(post("/api/invoices/{id}/issue", invoiceId)
                        .header("Authorization", bearer(cashierToken)))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/invoices/{id}/record-payment", invoiceId)
                        .header("Authorization", bearer(cashierToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("PAID"));

        return orderId;
    }

    private void submitEstimation(long orderId) throws Exception {
        String adminToken = login("admin@gmail.com", ADMIN_PASSWORD);
        String tailorToken = login("tailor@gmail.com", TAILOR_PASSWORD);
        long tailorId = userId(tailorToken);

        mockMvc.perform(post("/api/orders/{id}/assign-tailor", orderId)
                        .header("Authorization", bearer(adminToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"tailorId":%d}""".formatted(tailorId)))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/orders/{id}/estimation", orderId)
                        .header("Authorization", bearer(tailorToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"estimatedPrice":2000.0,"estimatedCompletionDate":"2026-12-10"}"""))
                .andExpect(status().isOk());
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
                                {"username":"%s","password":"Str0ng!Pass","fullName":"Fulfillment Tester",
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

    private long userId(String token) throws Exception {
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