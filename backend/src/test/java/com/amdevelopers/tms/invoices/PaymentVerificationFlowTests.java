package com.amdevelopers.tms.invoices;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
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
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class PaymentVerificationFlowTests {

    private static final String ADMIN_PASSWORD = "123456";
    private static final String CASHIER_PASSWORD = "123456";
    private static final String TAILOR_PASSWORD = "123456";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void customer_submits_proof_and_cashier_approval_marks_invoice_paid() throws Exception {
        String customerToken = register(uniqueUsername());
        IssuedInvoice invoice = toIssued(customerToken);

        // The owning customer submits a screenshot + message.
        long proofId = idFrom(mockMvc.perform(multipart("/api/payment-verifications")
                        .file(screenshot())
                        .param("invoiceId", String.valueOf(invoice.invoiceId))
                        .param("message", "Paid PKR 2000 via JazzCash, ref #48291, today at 11:20.")
                        .header("Authorization", bearer(customerToken)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.status").value("PENDING"))
                .andExpect(jsonPath("$.data.invoiceNumber").value(invoice.invoiceNumber))
                .andExpect(jsonPath("$.data.totalAmount").value(2000.0))
                .andExpect(jsonPath("$.data.screenshotUrl").exists())
                .andReturn());

        // A second proof cannot stack on the pending one.
        mockMvc.perform(multipart("/api/payment-verifications")
                        .file(screenshot())
                        .param("invoiceId", String.valueOf(invoice.invoiceId))
                        .param("message", "Another transfer.")
                        .header("Authorization", bearer(customerToken)))
                .andExpect(status().isConflict());

        // The cashier sees the pending proof in the review queue.
        String cashierToken = login("cashier@gmail.com", CASHIER_PASSWORD);
        mockMvc.perform(get("/api/payment-verifications")
                        .header("Authorization", bearer(cashierToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[?(@.id == %d)]", proofId).exists())
                .andExpect(jsonPath("$.data[?(@.invoiceId == %d)]", invoice.invoiceId).exists());

        // Approving settles the invoice and releases the order.
        mockMvc.perform(post("/api/payment-verifications/{id}/approve", proofId)
                        .header("Authorization", bearer(cashierToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"note":"Screenshot matches the JazzCash receipt and total."}"""))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("APPROVED"))
                .andExpect(jsonPath("$.data.reviewedAt").exists())
                .andExpect(jsonPath("$.data.reviewedBy").value("Cashier Staff"));

        mockMvc.perform(get("/api/invoices/{id}", invoice.invoiceId)
                        .header("Authorization", bearer(cashierToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("PAID"))
                .andExpect(jsonPath("$.data.paidAt").exists());

        String adminToken = login("admin@gmail.com", ADMIN_PASSWORD);
        mockMvc.perform(get("/api/orders/{id}", invoice.orderId)
                        .header("Authorization", bearer(adminToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("PAID"));

        // The queue is empty again.
        mockMvc.perform(get("/api/payment-verifications")
                        .header("Authorization", bearer(cashierToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data", hasSize(0)));
    }

    @Test
    void rejected_proof_needs_a_reason_and_allows_resubmission() throws Exception {
        String customerToken = register(uniqueUsername());
        IssuedInvoice invoice = toIssued(customerToken);

        long proofId = idFrom(mockMvc.perform(multipart("/api/payment-verifications")
                        .file(screenshot())
                        .param("invoiceId", String.valueOf(invoice.invoiceId))
                        .param("message", "Paid via bank transfer.")
                        .header("Authorization", bearer(customerToken)))
                .andExpect(status().isCreated())
                .andReturn());

        String cashierToken = login("cashier@gmail.com", CASHIER_PASSWORD);

        // Rejecting without a reason is refused.
        mockMvc.perform(post("/api/payment-verifications/{id}/reject", proofId)
                        .header("Authorization", bearer(cashierToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest());

        // A reasoned rejection keeps the invoice payable and tells the customer why.
        mockMvc.perform(post("/api/payment-verifications/{id}/reject", proofId)
                        .header("Authorization", bearer(cashierToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"note":"The screenshot is illegible. Please send a clearer receipt."}"""))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("REJECTED"))
                .andExpect(jsonPath("$.data.reviewNote").value(
                        "The screenshot is illegible. Please send a clearer receipt."));

        mockMvc.perform(get("/api/invoices/{id}", invoice.invoiceId)
                        .header("Authorization", bearer(cashierToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("ISSUED"));

        // The customer sees the rejection and may resubmit fresh evidence.
        mockMvc.perform(get("/api/payment-verifications/invoice/{invoiceId}", invoice.invoiceId)
                        .header("Authorization", bearer(customerToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data[0].status").value("REJECTED"))
                .andExpect(jsonPath("$.data[0].reviewNote").exists());

        long resubmittedId = idFrom(mockMvc.perform(multipart("/api/payment-verifications")
                        .file(screenshot())
                        .param("invoiceId", String.valueOf(invoice.invoiceId))
                        .param("message", "Paid PKR 2000 via JazzCash — clearer screenshot attached.")
                        .header("Authorization", bearer(customerToken)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.status").value("PENDING"))
                .andReturn());

        mockMvc.perform(post("/api/payment-verifications/{id}/approve", resubmittedId)
                        .header("Authorization", bearer(cashierToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("APPROVED"));
    }

    @Test
    void proof_submission_is_role_and_ownership_gated() throws Exception {
        String customerToken = register(uniqueUsername());
        IssuedInvoice invoice = toIssued(customerToken);

        // A tailor cannot submit or review proofs.
        String tailorToken = login("tailor@gmail.com", TAILOR_PASSWORD);
        mockMvc.perform(multipart("/api/payment-verifications")
                        .file(screenshot())
                        .param("invoiceId", String.valueOf(invoice.invoiceId))
                        .param("message", "Paid.")
                        .header("Authorization", bearer(tailorToken)))
                .andExpect(status().isForbidden());
        mockMvc.perform(get("/api/payment-verifications")
                        .header("Authorization", bearer(tailorToken)))
                .andExpect(status().isForbidden());

        // Another customer cannot read the invoice owner's proof history.
        String otherCustomerToken = register(uniqueUsername());
        mockMvc.perform(get("/api/payment-verifications/invoice/{invoiceId}", invoice.invoiceId)
                        .header("Authorization", bearer(otherCustomerToken)))
                .andExpect(status().isForbidden());

        // Only issued/overdue invoices can carry proof: a fresh DRAFT cannot.
        String secondCustomerToken = register(uniqueUsername());
        IssuedInvoice draftOnly = toDraft(secondCustomerToken);
        mockMvc.perform(multipart("/api/payment-verifications")
                        .file(screenshot())
                        .param("invoiceId", String.valueOf(draftOnly.invoiceId))
                        .param("message", "Paid.")
                        .header("Authorization", bearer(secondCustomerToken)))
                .andExpect(status().isConflict());
    }

    /** Generates (but does not issue) an invoice for a fresh customer's order. */
    private IssuedInvoice toDraft(String customerToken) throws Exception {
        long orderId = createOrder(customerToken);
        estimate(orderId);
        String cashierToken = login("cashier@gmail.com", CASHIER_PASSWORD);
        long invoiceId = idFrom(mockMvc.perform(post("/api/invoices")
                        .param("orderId", String.valueOf(orderId))
                        .header("Authorization", bearer(cashierToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.orderStatus").value("INVOICED"))
                .andReturn());
        return new IssuedInvoice(invoiceId, orderId, "");
    }

    /** Creates a fully issued invoice for a fresh customer's estimated order. */
    private IssuedInvoice toIssued(String customerToken) throws Exception {
        long orderId = createOrder(customerToken);
        estimate(orderId);
        String cashierToken = login("cashier@gmail.com", CASHIER_PASSWORD);
        MvcResult result = mockMvc.perform(post("/api/invoices")
                        .param("orderId", String.valueOf(orderId))
                        .header("Authorization", bearer(cashierToken))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.data.orderStatus").value("INVOICED"))
                .andReturn();
        long invoiceId = idFrom(result);
        String invoiceNumber = objectMapper.readTree(result.getResponse().getContentAsString())
                .path("data").path("invoiceNumber").asText();

        mockMvc.perform(post("/api/invoices/{id}/issue", invoiceId)
                        .header("Authorization", bearer(cashierToken)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.status").value("ISSUED"));

        return new IssuedInvoice(invoiceId, orderId, invoiceNumber);
    }

    private long createOrder(String customerToken) throws Exception {
        return idFrom(mockMvc.perform(multipart("/api/orders")
                        .param("title", "Payment Verification Order")
                        .header("Authorization", bearer(customerToken)))
                .andExpect(status().isCreated())
                .andReturn());
    }

    private void estimate(long orderId) throws Exception {
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

    private static MockMultipartFile screenshot() {
        return new MockMultipartFile(
                "screenshot", "receipt.png", "image/png", new byte[]{1, 2, 3, 4, 5});
    }

    private String uniqueUsername() {
        return "pay_" + Long.toHexString(System.nanoTime());
    }

    private static String bearer(String token) {
        return "Bearer " + token;
    }

    private String register(String username) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"username":"%s","password":"Str0ng!Pass","fullName":"Payment Tester",
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

    private record IssuedInvoice(long invoiceId, long orderId, String invoiceNumber) {
    }
}
