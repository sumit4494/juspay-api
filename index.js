/**
 * Dependencies
 */
const express = require("express");
const path = require("path");
const { Juspay, APIError } = require("expresscheckout-nodejs");

/**
 * Load Config
 */
const config = require("./config.json");

/**
 * Environment URLs
 */
const SANDBOX_BASE_URL = "https://smartgatewayuat.hdfcbank.com"; // 🔹 UAT Sandbox
const PRODUCTION_BASE_URL = "https://smartgateway.hdfcbank.com";  // 🔹 Live URL

/**
 * Load Keys from Environment Variables (NOT files)
 */
const publicKey = process.env.PUBLIC_KEY;
const privateKey = process.env.PRIVATE_KEY;

if (!publicKey || !privateKey) {
  console.error("❌ PUBLIC_KEY or PRIVATE_KEY is missing in Render environment variables!");
  process.exit(1);
}

/**
 * Initialize Juspay SDK
 */
const juspay = new Juspay({
  merchantId: config.MERCHANT_ID,
  baseUrl: SANDBOX_BASE_URL, // 🔹 Change to PRODUCTION_BASE_URL for live
  jweAuth: {
    keyId: config.KEY_UUID,
    publicKey,
    privateKey,
  },
});

/**
 * Initialize Express App
 */
const app = express();
const PORT = process.env.PORT || 5000;

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/**
 * Route: Home Page
 */
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

/**
 * Route: Initiate Juspay Payment
 */
app.post("/initiatejuspaypayment", async (req, res) => {
  const { amount, customer_id } = req.body;

  const orderId = `order_${Date.now()}`;
  const paymentAmount = amount || "100.00"; // Default ₹100 for demo
  const customerId = customer_id || "test_customer_1";
  const returnUrl = `https://jeyporedukaan.in/handleJuspayResponse`;

  try {
    const sessionResponse = await juspay.orderSession.create({
      order_id: orderId,
      amount: paymentAmount,
      payment_page_client_id: config.PAYMENT_PAGE_CLIENT_ID,
      customer_id: customerId,
      action: "paymentPage",
      return_url: returnUrl,
      currency: "INR",
    });

    res.json(cleanResponse(sessionResponse));
  } catch (error) {
    sendError(res, error);
  }
});

/**
 * Route: Handle Juspay Payment Callback
 */
app.post("/handleJuspayResponse", async (req, res) => {
  const orderId = req.body.order_id || req.body.orderId;

  if (!orderId) {
    return res.status(400).json(makeError("order_id is missing"));
  }

  try {
    const statusResponse = await juspay.order.status(orderId);
    const status = statusResponse.status;

    const messages = {
      CHARGED: "✅ Payment successful",
      PENDING: "⏳ Payment is pending",
      PENDING_VBV: "⏳ Payment is pending",
      AUTHORIZATION_FAILED: "❌ Authorization failed",
      AUTHENTICATION_FAILED: "❌ Authentication failed",
    };

    res.json({
      ...cleanResponse(statusResponse),
      message: messages[status] || `Order status: ${status}`,
    });
  } catch (error) {
    sendError(res, error);
  }
});

/**
 * Start Server
 */
app.listen(PORT, () => {
  console.log(`🚀 Juspay Server running at http://localhost:${PORT}`);
});

/**
 * Utility Functions
 */
function makeError(message) {
  return { success: false, message: message || "Something went wrong" };
}

function cleanResponse(response) {
  if (!response) return response;
  const rsp = { ...response };
  delete rsp.http; // Remove unnecessary fields
  return rsp;
}

function sendError(res, error) {
  if (error instanceof APIError) {
    return res.status(400).json(makeError(error.message));
  }
  console.error("Unexpected Error:", error);
  return res.status(500).json(makeError());
}
