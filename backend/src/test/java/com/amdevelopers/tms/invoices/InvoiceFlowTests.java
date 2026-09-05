package com.amdevelopers.tms.invoices;

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
class InvoiceFlowTests {

    private static final String TAILOR_PASSWORD = "tailor123";
    private static final String CASHIER_PASSWORD = "cashier123";
    private static final String ADMIN_PASSWORD = "admin123";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void cashier_generates_invoice_and_marks_paid() throws Exception {
        long orderId = toEstimated();

        String cashierToken = login("cashier1", CASHIER_PASSWORD);

        MvcResult generated = mockMvc.perform(post("/api/invoices")
                        .param("orderId", String.valueOf(orderId))
                        .header("Authorization", bearer(cashierToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(generateBody()))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.orderStatus").value("INVOICED"))
                .andExpect(jsonPath("$.data.paymentStatus").value("PENDING"))
                .andExpect(jsonPath("$.data.amount").value(5000.0))
                .andExpect(jsonPath("$.data.referenceNumber").value("INV-001"))
                .andExpect(jsonPath("$.data.issuedBy").value("Demo Cashier"))
                .andReturn();
        long invoiceId = idFrom(generated);

        mockMvc.perform(get("/api/invoices/order/{orderId}", orderId)
                        .header("Authorization", bearer(cashierToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value(invoiceId));

        mockMvc.perform(patch("/api/invoices/{id}/status", invoiceId)
                        .header("Authorization", bearer(cashierToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"paymentStatus":"PAID"}"""))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.paymentStatus").value("PAID"))
                .andExpect(jsonPath("$.data.paidAt").exists());

        String adminToken = login("admin", ADMIN_PASSWORD);
        mockMvc.perform(get("/api/orders/{id}", orderId).header("Authorization", bearer(adminToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("PAID"));
    }

    @Test
    void state_machine_is_strictly_enforced() throws Exception {
        String customerToken = register(uniqueUsername());
        long orderId = idFrom(mockMvc.perform(multipart("/api/orders")
                        .param("title", "Strict Transition Test")
                        .header("Authorization", bearer(customerToken)))
                .andExpect(status().isCreated())
                .andReturn());
        String cashierToken = login("cashier1", CASHIER_PASSWORD);

        // Not yet ESTIMATED -> invoice generation rejected
        mockMvc.perform(post("/api/invoices")
                        .param("orderId", String.valueOf(orderId))
                        .header("Authorization", bearer(cashierToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(generateBody()))
                .andExpect(status().isConflict());

        submitEstimation(orderId);
        MvcResult generated = mockMvc.perform(post("/api/invoices")
                        .param("orderId", String.valueOf(orderId))
                        .header("Authorization", bearer(cashierToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(generateBody()))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.orderStatus").value("INVOICED"))
                .andReturn();
        long invoiceId = idFrom(generated);

        // Duplicate invoice rejected
        mockMvc.perform(post("/api/invoices")
                        .param("orderId", String.valueOf(orderId))
                        .header("Authorization", bearer(cashierToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(generateBody()))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value("Order " + orderId + " already has an invoice"));

        // Failed payment keeps the order in INVOICED so it can be retried
        mockMvc.perform(patch("/api/invoices/{id}/status", invoiceId)
                        .header("Authorization", bearer(cashierToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"paymentStatus":"FAILED"}"""))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.paymentStatus").value("FAILED"));

        mockMvc.perform(patch("/api/invoices/{id}/status", invoiceId)
                        .header("Authorization", bearer(cashierToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"paymentStatus":"PAID"}"""))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.paymentStatus").value("PAID"));

        // Already PAID -> further transitions rejected
        mockMvc.perform(patch("/api/invoices/{id}/status", invoiceId)
                        .header("Authorization", bearer(cashierToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"paymentStatus":"FAILED"}"""))
                .andExpect(status().isConflict());
    }

    @Test
    void invoice_endpoints_are_cashier_or_admin_only() throws Exception {
        String customerToken = register(uniqueUsername());
        long orderId = toEstimated();

        String tailorToken = login("tailor1", TAILOR_PASSWORD);
        mockMvc.perform(post("/api/invoices")
                        .param("orderId", String.valueOf(orderId))
                        .header("Authorization", bearer(tailorToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(generateBody()))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/invoices/order/{orderId}", orderId)
                        .header("Authorization", bearer(customerToken)))
                .andExpect(status().isForbidden());
    }

    /**
     * Registers a fresh customer, creates an order, assigns the demo tailor
     * and submits an estimation so the order reaches ESTIMATED. Returns order id.
     */
    private long toEstimated() throws Exception {
        String customerToken = register(uniqueUsername());
        long orderId = idFrom(mockMvc.perform(multipart("/api/orders")
                        .param("title", "Cashier Workflow Order")
                        .header("Authorization", bearer(customerToken)))
                .andExpect(status().isCreated())
                .andReturn());
        submitEstimation(orderId);
        return orderId;
    }

    private void submitEstimation(long orderId) throws Exception {
        String adminToken = login("admin", ADMIN_PASSWORD);
        String tailorToken = login("tailor1", TAILOR_PASSWORD);
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
                        .content("""
                                {"estimatedPrice":2000.0,"estimatedCompletionDate":"2026-12-10"}"""))
                .andExpect(status().isOk());
    }

    private static String generateBody() {
        return """
                {"amount":5000.0,"accountNumber":"ACC-001","referenceNumber":"INV-001"}""";
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
                                {"username":"%s","password":"Str0ng!Pass","fullName":"Invoice Tester",
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