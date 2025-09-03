/**
 * Dependencies
 */
const express = require("express");
const { Juspay, APIError } = require("expresscheckout-nodejs");

/**
 * Load Config
 */
const config = require("./config.json");

/**
 * Environment URLs
 */
const SANDBOX_BASE_URL = "https://smartgatewayuat.hdfcbank.com"; // 🔹 UAT Sandbox
const PRODUCTION_BASE_URL = "https://smartgateway.hdfcbank.com"; // 🔹 Live URL

/**
 * Load Keys from Environment Variables
 */
const publicKey = process.env.PUBLIC_KEY;
const privateKey = process.env.PRIVATE_KEY;

if (!publicKey || !privateKey) {
  console.error("❌ Missing PUBLIC_KEY or PRIVATE_KEY in environment variables!");
  process.exit(1);
}

/**
 * Initialize Juspay SDK
 */
const juspay = new Juspay({
  merchantId: config.MERCHANT_ID,
  baseUrl: SANDBOX_BASE_URL, // 🔹 Change to PRODUCTION_BASE_URL when going live
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
const port = process.env.PORT || 5000;

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/**
 * Route: Home
 */
app.get("/", (req, res) => {
  res.sendFile(require("path").join(__dirname, "index.html"));
});

/**
 * Route: Initiate Juspay Payment
 */
app.post("/initiateJuspayPayment", async (req, res) => {
  const orderId = `order_${Date.now()}`;
  const amount = Math.floor(1 + Math.random() * 100); // 🔹 Demo random amount

  const returnUrl = `https://jeyporedukaan.in/handleJuspayResponse`; // 🔹 Replace with your domain

  try {
    const sessionResponse = await juspay.orderSession.create({
      order_id: orderId,
      amount: amount,
      payment_page_client_id: config.PAYMENT_PAGE_CLIENT_ID,
      customer_id: "hdfc-testing-customer-one", // 🔹 Replace dynamically if needed
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
 * Route: Handle Juspay Callback
 */
app.post("/handleJuspayResponse", async (req, res) => {
  const orderId = req.body.order_id || req.body.orderId;

  if (!orderId) {
    return res.status(400).json(makeError("order_id is missing"));
  }

  try {
    const statusResponse = await juspay.order.status(orderId);
    const orderStatus = statusResponse.status;

    const messages = {
      CHARGED: "Order payment successful ✅",
      PENDING: "Order payment is pending ⏳",
      PENDING_VBV: "Order payment is pending ⏳",
      AUTHORIZATION_FAILED: "Order payment authorization failed ❌",
      AUTHENTICATION_FAILED: "Order payment authentication failed ❌",
    };

    res.json({
      ...cleanResponse(statusResponse),
      message: messages[orderStatus] || `Order status: ${orderStatus}`,
    });
  } catch (error) {
    sendError(res, error);
  }
});

/**
 * Start Server
 */
app.listen(port, () => {
  console.log(`🚀 Server running at http://localhost:${port}`);
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
  delete rsp.http; // Remove unnecessary field
  return rsp;
}

function sendError(res, error) {
  if (error instanceof APIError) {
    return res.status(400).json(makeError(error.message));
  }
  console.error("Unexpected Error:", error);
  return res.status(500).json(makeError());
}

