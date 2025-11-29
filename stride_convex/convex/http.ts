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
 * Geomi Indexer Webhook
 * POST /geomi-webhook
 *
 * Called by Geomi No-Code Indexer when blockchain events occur
 * Handles real-time SIP execution notifications
 */
http.route({
  path: "/geomi-webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      // Validate webhook signature (if Geomi provides one)
      const signature = request.headers.get("X-Geomi-Signature");
      // TODO: Implement signature verification when Geomi provides it

      const body = await request.json();
      const { event_type, data } = body as {
        event_type: string;
        data: any;
      };

      console.log(`[Geomi Webhook] Event: ${event_type}`, data);

      // Handle different event types
      switch (event_type) {
        case "sip_executed":
          await handleSIPExecutedEvent(ctx, data);
          break;

        case "vault_created":
          await handleVaultCreatedEvent(ctx, data);
          break;

        case "deposit":
          await handleDepositEvent(ctx, data);
          break;

        case "sip_created":
          await handleSIPCreatedEvent(ctx, data);
          break;

        default:
          console.log(`[Geomi Webhook] Unknown event type: ${event_type}`);
      }

      return new Response(JSON.stringify({ status: "processed", event_type }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    } catch (error) {
      console.error("[Geomi Webhook] Error:", error);

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

// ============================================================================
// WEBHOOK EVENT HANDLERS
// ============================================================================

/**
 * Handle SIP Executed event from Geomi
 */
async function handleSIPExecutedEvent(ctx: any, data: any) {
  const {
    vault_address,
    sip_index,
    amount_in,
    amount_out,
    transaction_hash,
    timestamp,
  } = data;

  console.log(
    `[Geomi] SIP Executed: Vault ${vault_address}, Index ${sip_index}, TxHash ${transaction_hash}`
  );

  // Find the SIP by vault address and index
  // This requires querying our database to match vault_address to a user's SIP
  // For now, we'll just log it - full implementation would:
  // 1. Query SIPs table for matching vaultAddress and sipIndex
  // 2. Update SIP statistics
  // 3. Generate receipt
  // 4. Trigger rewards

  // TODO: Implement full SIP update logic
  // const sip = await ctx.runQuery(internal.sips.getByVaultAndIndex, {
  //   vaultAddress: vault_address,
  //   sipIndex: sip_index,
  // });
}

/**
 * Handle Vault Created event from Geomi
 */
async function handleVaultCreatedEvent(ctx: any, data: any) {
  const { user_address, vault_address, timestamp } = data;

  console.log(
    `[Geomi] Vault Created: User ${user_address}, Vault ${vault_address}`
  );

  // Update user record with vault address
  // TODO: Implement vault address update
  // const user = await ctx.runQuery(internal.users.getByWalletAddress, {
  //   walletAddress: user_address,
  // });
  // if (user) {
  //   await ctx.runMutation(internal.users.updateVaultAddress, {
  //     userId: user._id,
  //     vaultAddress: vault_address,
  //   });
  // }
}

/**
 * Handle Deposit event from Geomi
 */
async function handleDepositEvent(ctx: any, data: any) {
  const { vault_address, asset, amount, timestamp } = data;

  console.log(
    `[Geomi] Deposit: Vault ${vault_address}, Asset ${asset}, Amount ${amount}`
  );

  // Record deposit in transactions
  // TODO: Implement deposit recording
}

/**
 * Handle SIP Created event from Geomi
 */
async function handleSIPCreatedEvent(ctx: any, data: any) {
  const { vault_address, sip_index, target_asset, amount, frequency } = data;

  console.log(
    `[Geomi] SIP Created: Vault ${vault_address}, Index ${sip_index}, Target ${target_asset}`
  );

  // Update SIP record with on-chain index
  // TODO: Implement SIP index update
}

export default http;
