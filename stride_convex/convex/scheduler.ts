import {
  Aptos,
  AptosConfig,
  Ed25519Account,
  Ed25519PrivateKey,
  Network,
} from "@aptos-labs/ts-sdk";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import {
  internalAction,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import {
  APTOS_FULLNODE_URL,
  CONTRACT_ADDRESS,
  IS_MAINNET,
  WALLET_CONFIG,
} from "./constants";
import {
  extractOrderIdFromTransaction,
  getPrimarySubaccountAddress,
  waitForOrderFill,
} from "./lib/econia";

/**
 * SIP Scheduler Module
 *
 * Handles the automated execution of Systematic Investment Plans (SIPs).
 * Runs on a cron schedule to process due SIPs and trigger blockchain transactions.
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

type SIPData = {
  _id: Id<"sips">;
  _creationTime: number;
  userId: Id<"users">;
  amount: number;
  frequency: "hourly" | "daily" | "weekly" | "biweekly" | "monthly";
  tokenAddress?: string;
  tokenSymbol?: string;
  vaultAddress?: string;
  sipIndex?: number;
  status: "active" | "paused" | "cancelled" | "completed";
  nextExecution: number;
  lastExecutedAt?: number;
  executionCount: number;
  createdAt: number;
  updatedAt: number;
};

type UserForSIP = {
  _id: Id<"users">;
  phone: string;
  walletAddress?: string;
  photonId?: string;
  accessToken?: string;
} | null;

type ExecutionResult = {
  success: boolean;
  txHash?: string;
  error?: string;
};

// ============================================================================
// INTERNAL QUERIES
// ============================================================================

/**
 * Get all SIPs due for execution
 * Returns active SIPs where nextExecution timestamp has passed
 */
export const getDueSIPs = internalQuery({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("sips"),
      _creationTime: v.number(),
      userId: v.id("users"),
      amount: v.number(),
      frequency: v.union(
        v.literal("hourly"),
        v.literal("daily"),
        v.literal("weekly"),
        v.literal("biweekly"),
        v.literal("monthly")
      ),
      tokenAddress: v.optional(v.string()),
      tokenSymbol: v.optional(v.string()),
      vaultAddress: v.optional(v.string()),
      status: v.union(
        v.literal("active"),
        v.literal("paused"),
        v.literal("cancelled"),
        v.literal("completed")
      ),
      nextExecution: v.number(),
      lastExecutedAt: v.optional(v.number()),
      executionCount: v.number(),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
  ),
  handler: async (ctx) => {
    const now = Date.now();

    // Query active SIPs
    const activeSips = await ctx.db
      .query("sips")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();

    // Filter to only due SIPs
    return activeSips.filter((sip) => sip.nextExecution <= now);
  },
});

/**
 * Get user data needed for SIP execution
 */
export const getUserForSIP = internalQuery({
  args: { userId: v.id("users") },
  returns: v.union(
    v.object({
      _id: v.id("users"),
      phone: v.string(),
      walletAddress: v.optional(v.string()),
      photonId: v.optional(v.string()),
      accessToken: v.optional(v.string()),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (!user) return null;

    return {
      _id: user._id,
      phone: user.phone,
      walletAddress: user.walletAddress,
      photonId: user.photonId,
      accessToken: user.accessToken,
    };
  },
});

// ============================================================================
// INTERNAL MUTATIONS
// ============================================================================

/**
 * Update SIP after successful execution
 */
export const markSIPExecuted = internalMutation({
  args: {
    sipId: v.id("sips"),
    txHash: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const sip = await ctx.db.get(args.sipId);
    if (!sip) return null;

    const now = Date.now();

    // Calculate next execution time based on frequency
    let nextExecution: number;
    switch (sip.frequency) {
      case "daily":
        nextExecution = now + 24 * 60 * 60 * 1000; // 24 hours
        break;
      case "weekly":
        nextExecution = now + 7 * 24 * 60 * 60 * 1000; // 7 days
        break;
      case "monthly":
        nextExecution = now + 30 * 24 * 60 * 60 * 1000; // 30 days
        break;
      default:
        nextExecution = now + 24 * 60 * 60 * 1000;
    }

    await ctx.db.patch(args.sipId, {
      lastExecutedAt: now,
      nextExecution: nextExecution,
      executionCount: sip.executionCount + 1,
      updatedAt: now,
    });

    return null;
  },
});

/**
 * Record a SIP execution transaction
 */
export const recordSIPTransaction = internalMutation({
  args: {
    userId: v.id("users"),
    sipId: v.id("sips"),
    amount: v.number(),
    tokenSymbol: v.optional(v.string()),
    txHash: v.optional(v.string()),
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("success"),
      v.literal("failed")
    ),
    errorMessage: v.optional(v.string()),
  },
  returns: v.id("transactions"),
  handler: async (ctx, args) => {
    const now = Date.now();

    return await ctx.db.insert("transactions", {
      userId: args.userId,
      sipId: args.sipId,
      type: "sip_execution",
      amount: args.amount,
      tokenSymbol: args.tokenSymbol,
      status: args.status,
      txHash: args.txHash,
      errorMessage: args.errorMessage,
      createdAt: now,
      completedAt: args.status === "success" ? now : undefined,
    });
  },
});

/**
 * Update transaction status
 */
export const updateTransactionStatus = internalMutation({
  args: {
    transactionId: v.id("transactions"),
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("success"),
      v.literal("failed")
    ),
    txHash: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const updates: {
      status: "pending" | "processing" | "success" | "failed";
      txHash?: string;
      errorMessage?: string;
      completedAt?: number;
    } = {
      status: args.status,
    };

    if (args.txHash) updates.txHash = args.txHash;
    if (args.errorMessage) updates.errorMessage = args.errorMessage;
    if (args.status === "success" || args.status === "failed") {
      updates.completedAt = Date.now();
    }

    await ctx.db.patch(args.transactionId, updates);
    return null;
  },
});

// ============================================================================
// HELPER FUNCTIONS (non-Convex)
// ============================================================================

/**
 * Execute SIP transaction on Aptos blockchain
 * TODO: Integrate with Aptos SDK for real transactions
 */

async function executeSIPOnChain(
  sip: SIPData,
  user: NonNullable<UserForSIP>
): Promise<ExecutionResult & { orderId?: string; fillAmount?: number }> {
  // Validate inputs
  if (!user.walletAddress) {
    return { success: false, error: "User wallet address not found" };
  }

  if (!sip.vaultAddress) {
    return { success: false, error: "Vault address not found" };
  }

  try {
    // Initialize Aptos Client
    const config = new AptosConfig({
      network: IS_MAINNET ? Network.MAINNET : Network.TESTNET,
      fullnode: APTOS_FULLNODE_URL,
    });
    const aptos = new Aptos(config);

    // Initialize Scheduler Account
    if (!WALLET_CONFIG.SCHEDULER_PRIVATE_KEY) {
      throw new Error("SCHEDULER_PRIVATE_KEY not configured");
    }
    const privateKey = new Ed25519PrivateKey(
      WALLET_CONFIG.SCHEDULER_PRIVATE_KEY
    );
    const schedulerAccount = new Ed25519Account({ privateKey });

    // Get admin address for access control
    const adminAddress = process.env.ADMIN_ADDRESS || CONTRACT_ADDRESS;

    // Build Transaction to execute SIP via our executor contract
    const transaction = await aptos.transaction.build.simple({
      sender: schedulerAccount.accountAddress,
      data: {
        function: `${CONTRACT_ADDRESS}::executor::execute_sip`,
        typeArguments: [],
        functionArguments: [
          sip.vaultAddress, // vault_obj
          0, // sip_index (first SIP in vault)
          "0x1::aptos_coin::AptosCoin", // input_asset (USDC placeholder - using APT for testnet)
          "0x1::aptos_coin::AptosCoin", // target_asset (APT)
          adminAddress, // admin_addr for access control
        ],
      },
    });

    // Submit transaction
    const pendingTx = await aptos.signAndSubmitTransaction({
      signer: schedulerAccount,
      transaction,
    });

    console.log(`[Scheduler] Transaction submitted: ${pendingTx.hash}`);

    // Wait for confirmation
    const executedTx = await aptos.waitForTransaction({
      transactionHash: pendingTx.hash,
    });

    if (!executedTx.success) {
      return {
        success: false,
        txHash: executedTx.hash,
        error: "Transaction failed on-chain",
      };
    }

    // Extract order ID from events (if Econia order was placed)
    const orderId = extractOrderIdFromTransaction(executedTx);

    // If we got an order ID, wait for fill
    let fillAmount: number | undefined;
    if (orderId) {
      console.log(`[Scheduler] Order placed: ${orderId}, waiting for fill...`);

      const subaccountAddr = getPrimarySubaccountAddress(user.walletAddress);
      const fillEvent = await waitForOrderFill(subaccountAddr, orderId, 30000);

      if (fillEvent) {
        fillAmount = fillEvent.fill_amount;
        console.log(`[Scheduler] Order filled: ${fillAmount} tokens received`);
      } else {
        console.warn(
          `[Scheduler] Order ${orderId} did not fill within timeout`
        );
      }
    }

    return {
      success: true,
      txHash: executedTx.hash,
      orderId: orderId ?? undefined,
      fillAmount,
    };
  } catch (error: any) {
    console.error("[Scheduler] On-chain execution failed:", error);
    return {
      success: false,
      error: error.message || "Unknown error during execution",
    };
  }
}

// ============================================================================
// INTERNAL ACTIONS
// ============================================================================

/**
 * Main batch execution action
 * Called by cron job to process all due SIPs
 */
export const executeBatch = internalAction({
  args: {},
  returns: v.object({
    processed: v.number(),
    successful: v.number(),
    failed: v.number(),
  }),
  handler: async (ctx) => {
    // Get all due SIPs - with explicit type annotation to break circular reference
    const dueSIPs: Array<SIPData> = await ctx.runQuery(
      internal.scheduler.getDueSIPs
    );

    if (dueSIPs.length === 0) {
      console.log("[Scheduler] No SIPs due for execution");
      return { processed: 0, successful: 0, failed: 0 };
    }

    console.log(`[Scheduler] Processing ${dueSIPs.length} due SIPs...`);

    let successful = 0;
    let failed = 0;

    for (const sip of dueSIPs) {
      try {
        // Get user data for this SIP - with explicit type annotation
        const user: UserForSIP = await ctx.runQuery(
          internal.scheduler.getUserForSIP,
          {
            userId: sip.userId,
          }
        );

        if (!user) {
          console.error(`[Scheduler] User not found for SIP ${sip._id}`);
          failed++;
          continue;
        }

        if (!user.walletAddress || !user.photonId) {
          console.error(
            `[Scheduler] User ${sip.userId} missing wallet/photon data`
          );
          failed++;
          continue;
        }

        // Record transaction as processing - with explicit type annotation
        const txId: Id<"transactions"> = await ctx.runMutation(
          internal.scheduler.recordSIPTransaction,
          {
            userId: sip.userId,
            sipId: sip._id,
            amount: sip.amount,
            tokenSymbol: sip.tokenSymbol,
            status: "processing",
          }
        );

        // Execute the SIP on-chain
        const executionResult = await executeSIPOnChain(sip, user);

        if (executionResult.success) {
          // Update transaction as successful
          await ctx.runMutation(internal.scheduler.updateTransactionStatus, {
            transactionId: txId,
            status: "success",
            txHash: executionResult.txHash,
          });

          // Mark SIP as executed and schedule next
          await ctx.runMutation(internal.scheduler.markSIPExecuted, {
            sipId: sip._id,
            txHash: executionResult.txHash,
          });

          // Trigger reward for SIP execution
          if (user.accessToken && user.photonId) {
            try {
              await ctx.runAction(internal.actions.photon.triggerSIPReward, {
                userId: sip.userId,
                sipId: sip._id,
                amount: sip.amount,
              });
            } catch (rewardError) {
              console.error(
                `[Scheduler] Failed to trigger reward for SIP ${sip._id}:`,
                rewardError
              );
              // Don't fail the SIP execution if reward fails
            }
          }

          successful++;
          console.log(
            `[Scheduler] SIP ${sip._id} executed successfully. TxHash: ${executionResult.txHash}`
          );
        } else {
          // Update transaction as failed
          await ctx.runMutation(internal.scheduler.updateTransactionStatus, {
            transactionId: txId,
            status: "failed",
            errorMessage: executionResult.error,
          });

          failed++;
          console.error(
            `[Scheduler] SIP ${sip._id} execution failed: ${executionResult.error}`
          );
        }
      } catch (error) {
        console.error(`[Scheduler] Error processing SIP ${sip._id}:`, error);
        failed++;
      }
    }

    console.log(
      `[Scheduler] Batch complete. Processed: ${dueSIPs.length}, Successful: ${successful}, Failed: ${failed}`
    );

    return {
      processed: dueSIPs.length,
      successful,
      failed,
    };
  },
});
