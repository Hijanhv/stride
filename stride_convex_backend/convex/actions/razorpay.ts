"use node";

import { v } from "convex/values";
import crypto from "crypto";
import Razorpay from "razorpay";
import { internal } from "../_generated/api";
import { action, internalAction } from "../_generated/server";

/**
 * Razorpay Integration Module
 *
 * Handles UPI payment processing:
 * - Order creation
 * - QR code generation
 * - Webhook signature verification
 * - Payment status tracking
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

function getRazorpayConfig() {
  return {
    KEY_ID: process.env.RAZORPAY_KEY_ID || "",
    KEY_SECRET: process.env.RAZORPAY_KEY_SECRET || "",
    WEBHOOK_SECRET: process.env.RAZORPAY_WEBHOOK_SECRET || "",
  };
}

function getRazorpayClient() {
  const config = getRazorpayConfig();

  if (!config.KEY_ID || !config.KEY_SECRET) {
    throw new Error("Razorpay credentials not configured");
  }

  return new Razorpay({
    key_id: config.KEY_ID,
    key_secret: config.KEY_SECRET,
  });
}

// ============================================================================
// PUBLIC ACTIONS
// ============================================================================

/**
 * Create a Razorpay order for UPI payment
 */
export const createOrder = action({
  args: {
    amount: v.number(), // in paise (₹100 = 10000 paise)
    userId: v.id("users"),
    currency: v.optional(v.string()),
    notes: v.optional(
      v.object({
        userId: v.string(),
        purpose: v.string(),
      })
    ),
  },
  returns: v.object({
    success: v.boolean(),
    orderId: v.optional(v.string()),
    amount: v.optional(v.number()),
    currency: v.optional(v.string()),
    error: v.optional(v.string()),
  }),
  handler: async (_ctx, args) => {
    try {
      const razorpay = getRazorpayClient();

      const order = await razorpay.orders.create({
        amount: args.amount,
        currency: args.currency || "INR",
        receipt: `receipt_${args.userId.toString()}_${Date.now()}`,
        notes: args.notes || {
          userId: args.userId.toString(),
          purpose: "wallet_deposit",
        },
      });

      console.log(`[Razorpay] Order created: ${order.id}`);

      return {
        success: true,
        orderId: order.id,
        amount: typeof order.amount === 'string' ? parseInt(order.amount) : order.amount,
        currency: order.currency,
      };
    } catch (error) {
      console.error("[Razorpay] Create order error:", error);

      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to create order",
      };
    }
  },
});

/**
 * Generate UPI QR code for payment
 */
export const generateUPIQR = action({
  args: {
    amount: v.number(), // in paise
    orderId: v.string(),
    description: v.optional(v.string()),
  },
  returns: v.object({
    success: v.boolean(),
    qrCode: v.optional(v.string()),
    upiLink: v.optional(v.string()),
    error: v.optional(v.string()),
  }),
  handler: async (_ctx, args) => {
    try {
      const razorpay = getRazorpayClient();

      // Create UPI QR code
      const qr = await razorpay.qrCode.create({
        type: "upi_qr",
        name: "Stride DCA",
        usage: "single_use",
        fixed_amount: true,
        payment_amount: args.amount,
        description: args.description || `Deposit for ${args.orderId}`,
        customer_id: args.orderId,
        close_by: Math.floor(Date.now() / 1000) + 900, // Expires in 15 minutes
      });

      console.log(`[Razorpay] QR code generated for order: ${args.orderId}`);

      return {
        success: true,
        qrCode: qr.image_url, // QR code image URL
        upiLink: qr.image_url, // Using image URL as QR code doesn't provide a UPI link
      };
    } catch (error) {
      console.error("[Razorpay] Generate QR error:", error);

      return {
        success: false,
        error: error instanceof Error ? error.message : "Failed to generate QR",
      };
    }
  },
});

/**
 * Fetch payment details
 */
export const getPaymentDetails = action({
  args: {
    paymentId: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    payment: v.optional(v.any()),
    error: v.optional(v.string()),
  }),
  handler: async (_ctx, args) => {
    try {
      const razorpay = getRazorpayClient();

      const payment = await razorpay.payments.fetch(args.paymentId);

      return {
        success: true,
        payment: {
          id: payment.id,
          amount: payment.amount,
          currency: payment.currency,
          status: payment.status,
          method: payment.method,
          vpa: payment.vpa, // UPI ID
          createdAt: payment.created_at,
        },
      };
    } catch (error) {
      console.error("[Razorpay] Fetch payment error:", error);

      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to fetch payment",
      };
    }
  },
});

// ============================================================================
// INTERNAL ACTIONS
// ============================================================================

/**
 * Verify webhook signature (internal)
 */
export const verifyWebhookSignature = internalAction({
  args: {
    signature: v.string(),
    payload: v.string(),
  },
  returns: v.boolean(),
  handler: async (_ctx, args) => {
    const config = getRazorpayConfig();

    if (!config.WEBHOOK_SECRET) {
      console.warn("[Razorpay] Webhook secret not configured");
      return false;
    }

    try {
      const expectedSignature = crypto
        .createHmac("sha256", config.WEBHOOK_SECRET)
        .update(args.payload)
        .digest("hex");

      return expectedSignature === args.signature;
    } catch (error) {
      console.error("[Razorpay] Signature verification error:", error);
      return false;
    }
  },
});

/**
 * Process payment captured event (internal)
 */
export const processPaymentCaptured = internalAction({
  args: {
    paymentId: v.string(),
    orderId: v.string(),
    amount: v.number(), // in paise
    userId: v.id("users"),
    vpa: v.optional(v.string()), // UPI ID
  },
  returns: v.object({
    success: v.boolean(),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    try {
      // Convert amount from paise to rupees
      const amountInRupees = args.amount / 100;

      console.log(
        `[Razorpay] Processing payment: ${args.paymentId}, Amount: ₹${amountInRupees}, User: ${args.userId}`
      );

      // 1. Record Deposit & Get Vault Address
      const { transactionId, vaultAddress } = await ctx.runMutation(
        internal.transactions.recordDepositAndGetVault,
        {
          userId: args.userId,
          amount: amountInRupees,
          paymentId: args.paymentId,
        }
      );

      if (!vaultAddress) {
        console.warn(`[Razorpay] User ${args.userId} has no vault address. Skipping treasury funding.`);
        return { success: true }; // Payment recorded, but no vault to fund yet
      }

      // 2. Trigger Treasury Funding
      await ctx.runAction(internal.actions.treasury.fundUserVault, {
        userId: args.userId,
        amountInr: amountInRupees,
        razorpayPaymentId: args.paymentId,
        vaultAddress: vaultAddress,
      });

      // 3. Update Transaction Status to Success
      await ctx.runMutation(internal.transactions.updateStatus, {
        transactionId,
        status: "success",
      });

      return {
        success: true,
      };
    } catch (error) {
      console.error("[Razorpay] Process payment error:", error);

      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Failed to process payment",
      };
    }
  },
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Generate UPI payment link (for simple integration)
 */
export const generateUPILink = action({
  args: {
    amount: v.number(), // in rupees
    vpa: v.optional(v.string()), // Merchant VPA
    name: v.optional(v.string()),
    transactionNote: v.optional(v.string()),
  },
  returns: v.string(),
  handler: async (_ctx, args) => {
    const vpa = args.vpa || "stride@ybl";
    const name = args.name || "Stride";
    const note = args.transactionNote || "Wallet Deposit";

    // Generate UPI deep link
    const upiLink = `upi://pay?pa=${vpa}&pn=${encodeURIComponent(name)}&am=${args.amount}&cu=INR&tn=${encodeURIComponent(note)}`;

    return upiLink;
  },
});
