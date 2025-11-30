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
// RAZORPAY WEBHOOKS
// ============================================================================

/**
 * Razorpay Payment Webhook
 * POST /razorpay-webhook
 *
 * Called by Razorpay when payment events occur (payment.captured, payment.failed, etc.)
 */
http.route({
  path: "/razorpay-webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const signature = request.headers.get("X-Razorpay-Signature");
      const body = await request.text();

      // TODO: Verify webhook signature using crypto.createHmac
      // For now, we'll process all webhooks (add verification in production)

      const event = JSON.parse(body);
      console.log(`[Razorpay] Event: ${event.event}`);

      // Handle different event types
      switch (event.event) {
        case "payment.captured":
          await handlePaymentCaptured(ctx, event.payload.payment.entity);
          break;

        case "payment.failed":
          await handlePaymentFailed(ctx, event.payload.payment.entity);
          break;

        case "order.paid":
          console.log("[Razorpay] Order paid:", event.payload.order.entity.id);
          break;

        default:
          console.log(`[Razorpay] Unhandled event: ${event.event}`);
      }

      return new Response(JSON.stringify({ status: "processed" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("[Razorpay Webhook] Error:", error);

      return new Response(
        JSON.stringify({
          error: "Failed to process webhook",
          message: error instanceof Error ? error.message : "Unknown error",
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  }),
});

/**
 * Handle successful payment
 */
async function handlePaymentCaptured(ctx: any, payment: any) {
  const { id, amount, notes, vpa } = payment;
  const userId = notes?.userId;

  if (!userId) {
    console.error("[Razorpay] Payment missing userId in notes:", id);
    return;
  }

  console.log(
    `[Razorpay] Payment captured: ${id}, Amount: ₹${amount / 100}, User: ${userId}`
  );

  // Record deposit (amount in paise, convert to rupees)
  await ctx.runMutation(internal.transactions.recordDeposit, {
    userId,
    amount: amount / 100, // Convert paise to rupees
    txHash: id,
    tokenSymbol: "INR",
  });

  console.log(`[Razorpay] Deposit recorded for user ${userId}`);
}

/**
 * Handle failed payment
 */
async function handlePaymentFailed(ctx: any, payment: any) {
  const { id, amount, notes, error_description } = payment;
  const userId = notes?.userId;

  if (!userId) {
    console.error("[Razorpay] Failed payment missing userId:", id);
    return;
  }

  console.log(
    `[Razorpay] Payment failed: ${id}, User: ${userId}, Error: ${error_description}`
  );

  // Record failed deposit
  await ctx.runMutation(internal.transactions.recordFailedDeposit, {
    userId,
    amount: amount / 100,
    txHash: id,
    errorMessage: error_description || "Payment failed",
  });
}

// ============================================================================
// APTOS BLOCKCHAIN EVENT TRACKING
// ============================================================================

/**
 * IMPORTANT: Geomi Event Indexing Architecture
 *
 * Geomi (Aptos Build) provides a No-Code Indexer that uses GraphQL for querying,
 * NOT webhooks for pushing data. The correct integration pattern is:
 *
 * 1. Configure No-Code Indexer in Aptos Build Dashboard:
 *    - Define event sources (contract events like SIPExecuted, VaultCreated)
 *    - Map events to database tables/schemas
 *    - Set up GraphQL endpoint
 *
 * 2. Poll Geomi GraphQL Endpoint:
 *    - Use Convex cron job to poll every 5-10 seconds
 *    - Query for new events since last poll
 *    - Process events and update local database
 *
 * 3. Track Decibel Order Fills:
 *    - Monitor Decibel's OrderFillEvent via Geomi
 *    - Extract fill details (amount_out, price, timestamp)
 *    - Update SIP statistics with actual fill data
 *
 * Event Tracking is implemented in:
 * - stride_convex/convex/indexer/geomi-client.ts - GraphQL polling client
 * - stride_convex/convex/indexer/order-fill-tracker.ts - Decibel fill tracking
 * - stride_convex/convex/crons.ts - Scheduled polling jobs
 */


export default http;
