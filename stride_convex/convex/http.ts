import { httpRouter } from "convex/server";
import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";

/**
 * HTTP Routes Module
 *
 * Handles external HTTP requests including:
 * - UPI payment webhooks
 * - Health checks
 * - External API callbacks
 */

const http = httpRouter();

// ============================================================================
// HEALTH CHECK
// ============================================================================

/**
 * Health check endpoint
 * GET /health
 */
http.route({
  path: "/health",
  method: "GET",
  handler: httpAction(async () => {
    return new Response(
      JSON.stringify({
        status: "healthy",
        timestamp: new Date().toISOString(),
        service: "stride-convex",
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  }),
});

// ============================================================================
// UPI WEBHOOKS
// ============================================================================

/**
 * UPI Payment Webhook
 * POST /upi-webhook
 *
 * Called by payment gateway when UPI payment is completed.
 *
 * Expected payload:
 * {
 *   "user_phone": string,
 *   "amount": number,
 *   "transaction_id": string,
 *   "status": "success" | "failed",
 *   "timestamp": string
 * }
 */
http.route({
  path: "/upi-webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      // Validate webhook signature (if provided)
      const signature = request.headers.get("X-Webhook-Signature");
      // TODO: Implement signature verification

      // Parse request body
      const body = await request.json();
      const { user_phone, amount, transaction_id, status, timestamp } =
        body as {
          user_phone: string;
          amount: number;
          transaction_id: string;
          status: string;
          timestamp?: string;
        };

      // Validate required fields
      if (!user_phone || !amount || !transaction_id || !status) {
        return new Response(
          JSON.stringify({
            error: "Missing required fields",
            required: ["user_phone", "amount", "transaction_id", "status"],
          }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      // Log webhook receipt
      console.log(
        `[UPI Webhook] Received: ${transaction_id}, Phone: ${user_phone}, Amount: ${amount}, Status: ${status}`
      );

      // Find user by phone
      const user = await ctx.runQuery(internal.users.getByPhoneInternal, {
        phone: user_phone,
      });

      if (!user) {
        console.error(`[UPI Webhook] User not found for phone: ${user_phone}`);
        return new Response(
          JSON.stringify({
            error: "User not found",
            phone: user_phone,
          }),
          { status: 404, headers: { "Content-Type": "application/json" } }
        );
      }

      // Process based on status
      if (status === "success") {
        // Record deposit transaction
        await ctx.runMutation(internal.transactions.recordDeposit, {
          userId: user._id,
          amount,
          txHash: transaction_id,
        });

        console.log(
          `[UPI Webhook] Deposit recorded for user ${user._id}: ${amount}`
        );

        // Optionally trigger a reward for deposit
        // await ctx.runAction(internal.photon.triggerDepositReward, { userId: user._id, amount });
      } else if (status === "failed") {
        // Record failed transaction for tracking
        await ctx.runMutation(internal.transactions.recordFailedDeposit, {
          userId: user._id,
          amount,
          txHash: transaction_id,
          errorMessage: "Payment failed",
        });

        console.log(
          `[UPI Webhook] Failed deposit recorded for user ${user._id}`
        );
      }

      return new Response(
        JSON.stringify({
          status: "processed",
          transaction_id,
          user_id: user._id,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    } catch (error) {
      console.error("[UPI Webhook] Error processing webhook:", error);

      return new Response(
        JSON.stringify({
          error: "Internal server error",
          message: error instanceof Error ? error.message : "Unknown error",
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  }),
});

// ============================================================================
// PHOTON CALLBACKS (if needed)
// ============================================================================

/**
 * Photon Event Callback
 * POST /photon-callback
 *
 * Called by Photon API for event confirmations (if configured)
 */
http.route({
  path: "/photon-callback",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const body = await request.json();

      console.log("[Photon Callback] Received:", JSON.stringify(body));

      // TODO: Process Photon callback events
      // This could be used for:
      // - Token minting confirmations
      // - Wallet creation confirmations
      // - Campaign event confirmations

      return new Response(JSON.stringify({ status: "received" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("[Photon Callback] Error:", error);

      return new Response(
        JSON.stringify({ error: "Failed to process callback" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  }),
});

// ============================================================================
// APTOS TRANSACTION WEBHOOKS (for on-chain events)
// ============================================================================

/**
 * Aptos Transaction Webhook
 * POST /aptos-webhook
 *
 * Could be called by an indexer service when relevant on-chain events occur
 */
http.route({
  path: "/aptos-webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const body = await request.json();

      console.log("[Aptos Webhook] Received:", JSON.stringify(body));

      // TODO: Process Aptos blockchain events
      // This could handle:
      // - SIP execution confirmations
      // - Token transfer events
      // - Vault deposit confirmations

      return new Response(JSON.stringify({ status: "received" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("[Aptos Webhook] Error:", error);

      return new Response(
        JSON.stringify({ error: "Failed to process webhook" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  }),
});

export default http;
