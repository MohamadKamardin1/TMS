package com.amdevelopers.tms.invoices;

import static org.hamcrest.Matchers.matchesPattern;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
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
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class InvoiceFlowTests {

    private static final String TAILOR_PASSWORD = "123456";
    private static final String CASHIER_PASSWORD = "123456";
    private static final String ADMIN_PASSWORD = "123456";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void cashier_drafts_edits_issues_and_records_payment() throws Exception {
        long orderId = toEstimated();
        String cashierToken = login("cashier@gmail.com", CASHIER_PASSWORD);

        // 1. Draft is created from the tailor estimate; order becomes INVOICED.
        long invoiceId = idFrom(mockMvc.perform(post("/api/invoices")
                        .param("orderId", String.valueOf(orderId))
                        .header("Authorization", bearer(cashierToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.status").value("DRAFT"))
                .andExpect(jsonPath("$.data.orderStatus").value("INVOICED"))
                .andExpect(jsonPath("$.data.invoiceNumber", matchesPattern("INV-\\d{4}-\\d{4}")))
                .andExpect(jsonPath("$.data.subtotal").value(2000.0))
                .andExpect(jsonPath("$.data.taxAmount").value(0.0))
                .andExpect(jsonPath("$.data.discountAmount").value(0.0))
                .andExpect(jsonPath("$.data.totalAmount").value(2000.0))
                .andReturn());

        // A second draft for the same order is rejected.
        mockMvc.perform(post("/api/invoices")
                        .param("orderId", String.valueOf(orderId))
                        .header("Authorization", bearer(cashierToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isConflict());

        // 2. Cashier adjusts tax/discount before finalising.
        mockMvc.perform(put("/api/invoices/{id}", invoiceId)
                        .header("Authorization", bearer(cashierToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"subtotal":2000.0,"taxAmount":60.0,"discountAmount":100.0,
                                 "paymentInstructions":"Bank transfer to ACC-9999",
                                 "dueDate":"2026-10-10"}"""))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("DRAFT"))
                .andExpect(jsonPath("$.data.totalAmount").value(1960.0))
                .andExpect(jsonPath("$.data.taxAmount").value(60.0))
                .andExpect(jsonPath("$.data.discountAmount").value(100.0))
                .andExpect(jsonPath("$.data.paymentInstructions").value("Bank transfer to ACC-9999"))
                .andExpect(jsonPath("$.data.dueDate").value("2026-10-10"));

        // 3. Issue finalises the document.
        mockMvc.perform(post("/api/invoices/{id}/issue", invoiceId)
                        .header("Authorization", bearer(cashierToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("ISSUED"))
                .andExpect(jsonPath("$.data.issuedAt").exists())
                .andExpect(jsonPath("$.data.issuedBy").value("Cashier Staff"));

        // Issued documents are immutable.
        mockMvc.perform(put("/api/invoices/{id}", invoiceId)
                        .header("Authorization", bearer(cashierToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"subtotal":100.0}"""))
                .andExpect(status().isConflict());
        mockMvc.perform(post("/api/invoices/{id}/issue", invoiceId)
                        .header("Authorization", bearer(cashierToken)))
                .andExpect(status().isConflict());

        // 4. Recording the payment marks the invoice PAID and the order PAID.
        mockMvc.perform(post("/api/invoices/{id}/record-payment", invoiceId)
                        .header("Authorization", bearer(cashierToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("PAID"))
                .andExpect(jsonPath("$.data.paidAt").exists());

        mockMvc.perform(post("/api/invoices/{id}/record-payment", invoiceId)
                        .header("Authorization", bearer(cashierToken)))
                .andExpect(status().isConflict());

        String adminToken = login("admin@gmail.com", ADMIN_PASSWORD);
        mockMvc.perform(get("/api/orders/{id}", orderId).header("Authorization", bearer(adminToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("PAID"));
    }

    @Test
    void invoices_require_an_estimated_order_and_strict_roles() throws Exception {
        String customerToken = register(uniqueUsername());
        long orderId = idFrom(mockMvc.perform(multipart("/api/orders")
                        .param("title", "Role Gate Order")
                        .header("Authorization", bearer(customerToken)))
                .andExpect(status().isCreated())
                .andReturn());
        String cashierToken = login("cashier@gmail.com", CASHIER_PASSWORD);

        // Not yet ESTIMATED -> invoice generation rejected.
        mockMvc.perform(post("/api/invoices")
                        .param("orderId", String.valueOf(orderId))
                        .header("Authorization", bearer(cashierToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isConflict());

        submitEstimation(orderId);

        // A tailor cannot generate invoices.
        String tailorToken = login("tailor@gmail.com", TAILOR_PASSWORD);
        mockMvc.perform(post("/api/invoices")
                        .param("orderId", String.valueOf(orderId))
                        .header("Authorization", bearer(tailorToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isForbidden());

        long invoiceId = idFrom(mockMvc.perform(post("/api/invoices")
                        .param("orderId", String.valueOf(orderId))
                        .header("Authorization", bearer(cashierToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isCreated())
                .andReturn());
        mockMvc.perform(post("/api/invoices/{id}/issue", invoiceId)
                        .header("Authorization", bearer(cashierToken)))
                .andExpect(status().isOk());

        // The owning customer may read their invoice...
        mockMvc.perform(get("/api/invoices/my-order/{orderId}", orderId)
                        .header("Authorization", bearer(customerToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.orderId").value(orderId));

        // ...but a different customer may not.
        String otherCustomerToken = register(uniqueUsername());
        mockMvc.perform(get("/api/invoices/my-order/{orderId}", orderId)
                        .header("Authorization", bearer(otherCustomerToken)))
                .andExpect(status().isForbidden());

        // Customers cannot list invoices.
        mockMvc.perform(get("/api/invoices")
                        .header("Authorization", bearer(customerToken)))
                .andExpect(status().isForbidden());
    }

    @Test
    void issued_invoices_become_overdue_and_can_still_be_paid() throws Exception {
        long orderId = toEstimated();
        String cashierToken = login("cashier@gmail.com", CASHIER_PASSWORD);

        long invoiceId = idFrom(mockMvc.perform(post("/api/invoices")
                        .param("orderId", String.valueOf(orderId))
                        .header("Authorization", bearer(cashierToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isCreated())
                .andReturn());

        // Backdate the due date so the lazy sweep promotes the invoice.
        mockMvc.perform(put("/api/invoices/{id}", invoiceId)
                        .header("Authorization", bearer(cashierToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"dueDate":"2020-01-01"}"""))
                .andExpect(status().isOk());

        mockMvc.perform(post("/api/invoices/{id}/issue", invoiceId)
                        .header("Authorization", bearer(cashierToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("ISSUED"));

        // Reading sweeps the overdue invoice.
        mockMvc.perform(get("/api/invoices/{id}", invoiceId)
                        .header("Authorization", bearer(cashierToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("OVERDUE"));

        // Filtering by OVERDUE returns it.
        mockMvc.perform(get("/api/invoices")
                        .param("status", "OVERDUE")
                        .header("Authorization", bearer(cashierToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[?(@.id == %d)]", invoiceId).exists());

        // An overdue invoice can still be settled.
        mockMvc.perform(post("/api/invoices/{id}/record-payment", invoiceId)
                        .header("Authorization", bearer(cashierToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("PAID"));
    }

    @Test
    void discarding_a_draft_returns_the_order_to_estimated() throws Exception {
        long orderId = toEstimated();
        String cashierToken = login("cashier@gmail.com", CASHIER_PASSWORD);
        String adminToken = login("admin@gmail.com", ADMIN_PASSWORD);

        long invoiceId = idFrom(mockMvc.perform(post("/api/invoices")
                        .param("orderId", String.valueOf(orderId))
                        .header("Authorization", bearer(cashierToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.orderStatus").value("INVOICED"))
                .andReturn());

        mockMvc.perform(delete("/api/invoices/{id}", invoiceId)
                        .header("Authorization", bearer(cashierToken)))
                .andExpect(status().isOk());

        // The order is billable again.
        mockMvc.perform(get("/api/orders/{id}", orderId).header("Authorization", bearer(adminToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("ESTIMATED"));

        // A fresh draft can now be generated.
        mockMvc.perform(post("/api/invoices")
                        .param("orderId", String.valueOf(orderId))
                        .header("Authorization", bearer(cashierToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isCreated());

        // Issued/paid documents cannot be discarded.
        long secondOrder = toEstimated();
        long secondInvoice = idFrom(mockMvc.perform(post("/api/invoices")
                        .param("orderId", String.valueOf(secondOrder))
                        .header("Authorization", bearer(cashierToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isCreated())
                .andReturn());
        mockMvc.perform(post("/api/invoices/{id}/issue", secondInvoice)
                        .header("Authorization", bearer(cashierToken)))
                .andExpect(status().isOk());
        mockMvc.perform(delete("/api/invoices/{id}", secondInvoice)
                        .header("Authorization", bearer(cashierToken)))
                .andExpect(status().isConflict());
    }

    /**
     * Registers a fresh customer, creates an order, assigns the demo tailor and
     * submits an estimation so the order reaches ESTIMATED (price 2000.0).
     */
    private long toEstimated() throws Exception {
        String customerToken = register(uniqueUsername());
        long orderId = idFrom(mockMvc.perform(multipart("/api/orders")
                        .param("title", "Invoice Workflow Order")
                        .header("Authorization", bearer(customerToken)))
                .andExpect(status().isCreated())
                .andReturn());
        submitEstimation(orderId);
        return orderId;
    }

    private void submitEstimation(long orderId) throws Exception {
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
