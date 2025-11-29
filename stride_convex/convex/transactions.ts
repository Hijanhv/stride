import { v } from "convex/values";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";

/**
 * Transactions Management Module
 *
 * Handles recording and querying all financial transactions:
 * - Deposits (UPI)
 * - Withdrawals
 * - SIP executions
 * - Rewards
 * - Swaps
 */

// ============================================================================
// TYPE VALIDATORS
// ============================================================================

const transactionTypeValidator = v.union(
  v.literal("deposit"),
  v.literal("withdrawal"),
  v.literal("sip_execution"),
  v.literal("reward"),
  v.literal("swap")
);

const transactionStatusValidator = v.union(
  v.literal("pending"),
  v.literal("processing"),
  v.literal("success"),
  v.literal("failed")
);

const transactionReturnValidator = v.object({
  _id: v.id("transactions"),
  _creationTime: v.number(),
  userId: v.id("users"),
  sipId: v.optional(v.id("sips")),
  type: transactionTypeValidator,
  amount: v.number(),
  tokenSymbol: v.optional(v.string()),
  tokenAddress: v.optional(v.string()),
  status: transactionStatusValidator,
  txHash: v.optional(v.string()),
  blockNumber: v.optional(v.number()),
  errorMessage: v.optional(v.string()),
  createdAt: v.number(),
  completedAt: v.optional(v.number()),
});

// ============================================================================
// PUBLIC QUERIES
// ============================================================================

/**
 * Get all transactions for a user
 */
export const getByUser = query({
  args: {
    userId: v.id("users"),
    limit: v.optional(v.number()),
  },
  returns: v.array(transactionReturnValidator),
  handler: async (ctx, args) => {
    let query = ctx.db
      .query("transactions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc");

    const results = await query.collect();

    if (args.limit) {
      return results.slice(0, args.limit);
    }

    return results;
  },
});

/**
 * Get transactions by type
 */
export const getByType = query({
  args: {
    userId: v.id("users"),
    type: transactionTypeValidator,
    limit: v.optional(v.number()),
  },
  returns: v.array(transactionReturnValidator),
  handler: async (ctx, args) => {
    const transactions = await ctx.db
      .query("transactions")
      .withIndex("by_user_and_type", (q) =>
        q.eq("userId", args.userId).eq("type", args.type)
      )
      .order("desc")
      .collect();

    if (args.limit) {
      return transactions.slice(0, args.limit);
    }

    return transactions;
  },
});

/**
 * Get a single transaction by ID
 */
export const getById = query({
  args: { transactionId: v.id("transactions") },
  returns: v.union(transactionReturnValidator, v.null()),
  handler: async (ctx, args) => {
    return await ctx.db.get(args.transactionId);
  },
});

/**
 * Get transaction summary for a user
 */
export const getSummary = query({
  args: { userId: v.id("users") },
  returns: v.object({
    totalDeposits: v.number(),
    totalWithdrawals: v.number(),
    totalSIPExecutions: v.number(),
    totalRewards: v.number(),
    pendingTransactions: v.number(),
  }),
  handler: async (ctx, args) => {
    const transactions = await ctx.db
      .query("transactions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    const successfulTxs = transactions.filter((t) => t.status === "success");

    const totalDeposits = successfulTxs
      .filter((t) => t.type === "deposit")
      .reduce((sum, t) => sum + t.amount, 0);

    const totalWithdrawals = successfulTxs
      .filter((t) => t.type === "withdrawal")
      .reduce((sum, t) => sum + t.amount, 0);

    const totalSIPExecutions = successfulTxs
      .filter((t) => t.type === "sip_execution")
      .reduce((sum, t) => sum + t.amount, 0);

    const totalRewards = successfulTxs
      .filter((t) => t.type === "reward")
      .reduce((sum, t) => sum + t.amount, 0);

    const pendingTransactions = transactions.filter(
      (t) => t.status === "pending" || t.status === "processing"
    ).length;

    return {
      totalDeposits,
      totalWithdrawals,
      totalSIPExecutions,
      totalRewards,
      pendingTransactions,
    };
  },
});

// ============================================================================
// PUBLIC MUTATIONS
// ============================================================================

/**
 * Create a withdrawal request
 */
export const createWithdrawal = mutation({
  args: {
    userId: v.id("users"),
    amount: v.number(),
    tokenSymbol: v.optional(v.string()),
  },
  returns: v.id("transactions"),
  handler: async (ctx, args) => {
    const now = Date.now();

    return await ctx.db.insert("transactions", {
      userId: args.userId,
      type: "withdrawal",
      amount: args.amount,
      tokenSymbol: args.tokenSymbol || "INR",
      status: "pending",
      createdAt: now,
    });
  },
});

// ============================================================================
// INTERNAL MUTATIONS
// ============================================================================

/**
 * Record a successful deposit (from UPI webhook)
 */
export const recordDeposit = internalMutation({
  args: {
    userId: v.id("users"),
    amount: v.number(),
    txHash: v.string(),
    tokenSymbol: v.optional(v.string()),
  },
  returns: v.id("transactions"),
  handler: async (ctx, args) => {
    const now = Date.now();

    return await ctx.db.insert("transactions", {
      userId: args.userId,
      type: "deposit",
      amount: args.amount,
      tokenSymbol: args.tokenSymbol || "INR",
      status: "success",
      txHash: args.txHash,
      createdAt: now,
      completedAt: now,
    });
  },
});

/**
 * Record deposit and get vault address (for Treasury)
 */
export const recordDepositAndGetVault = internalMutation({
  args: {
    userId: v.id("users"),
    amount: v.number(),
    paymentId: v.string(),
  },
  returns: v.object({
    transactionId: v.id("transactions"),
    vaultAddress: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const now = Date.now();
    
    // 1. Record Transaction
    const transactionId = await ctx.db.insert("transactions", {
      userId: args.userId,
      type: "deposit",
      amount: args.amount,
      tokenSymbol: "INR",
      status: "processing", // Processing until Treasury funds it
      txHash: args.paymentId, // Use Razorpay ID as hash initially
      createdAt: now,
    });

    // 2. Get User's Vault Address
    const user = await ctx.db.get(args.userId);
    
    return {
      transactionId,
      vaultAddress: user?.vaultAddress,
    };
  },
});

/**
 * Record a failed deposit (from UPI webhook)
 */
export const recordFailedDeposit = internalMutation({
  args: {
    userId: v.id("users"),
    amount: v.number(),
    txHash: v.string(),
    errorMessage: v.optional(v.string()),
  },
  returns: v.id("transactions"),
  handler: async (ctx, args) => {
    const now = Date.now();

    return await ctx.db.insert("transactions", {
      userId: args.userId,
      type: "deposit",
      amount: args.amount,
      status: "failed",
      txHash: args.txHash,
      errorMessage: args.errorMessage || "Payment failed",
      createdAt: now,
      completedAt: now,
    });
  },
});

/**
 * Record a SIP execution transaction
 */
export const recordSIPExecution = internalMutation({
  args: {
    userId: v.id("users"),
    sipId: v.id("sips"),
    amount: v.number(),
    tokenSymbol: v.optional(v.string()),
    tokenAddress: v.optional(v.string()),
    status: transactionStatusValidator,
    txHash: v.optional(v.string()),
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
      tokenAddress: args.tokenAddress,
      status: args.status,
      txHash: args.txHash,
      errorMessage: args.errorMessage,
      createdAt: now,
      completedAt:
        args.status === "success" || args.status === "failed" ? now : undefined,
    });
  },
});

/**
 * Record a reward transaction
 */
export const recordReward = internalMutation({
  args: {
    userId: v.id("users"),
    amount: v.number(),
    tokenSymbol: v.string(),
    txHash: v.optional(v.string()),
  },
  returns: v.id("transactions"),
  handler: async (ctx, args) => {
    const now = Date.now();

    return await ctx.db.insert("transactions", {
      userId: args.userId,
      type: "reward",
      amount: args.amount,
      tokenSymbol: args.tokenSymbol,
      status: "success",
      txHash: args.txHash,
      createdAt: now,
      completedAt: now,
    });
  },
});

/**
 * Update transaction status
 */
export const updateStatus = internalMutation({
  args: {
    transactionId: v.id("transactions"),
    status: transactionStatusValidator,
    txHash: v.optional(v.string()),
    blockNumber: v.optional(v.number()),
    errorMessage: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const updates: {
      status: "pending" | "processing" | "success" | "failed";
      txHash?: string;
      blockNumber?: number;
      errorMessage?: string;
      completedAt?: number;
    } = {
      status: args.status,
    };

    if (args.txHash) updates.txHash = args.txHash;
    if (args.blockNumber) updates.blockNumber = args.blockNumber;
    if (args.errorMessage) updates.errorMessage = args.errorMessage;

    if (args.status === "success" || args.status === "failed") {
      updates.completedAt = Date.now();
    }

    await ctx.db.patch(args.transactionId, updates);
    return null;
  },
});

// ============================================================================
// INTERNAL QUERIES
// ============================================================================

/**
 * Get pending transactions for a user
 */
export const getPendingByUser = internalQuery({
  args: { userId: v.id("users") },
  returns: v.array(
    v.object({
      _id: v.id("transactions"),
      type: transactionTypeValidator,
      amount: v.number(),
      createdAt: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    const transactions = await ctx.db
      .query("transactions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    return transactions
      .filter((t) => t.status === "pending" || t.status === "processing")
      .map((t) => ({
        _id: t._id,
        type: t.type,
        amount: t.amount,
        createdAt: t.createdAt,
      }));
  },
});

/**
 * Check if a transaction hash already exists (idempotency)
 */
export const txHashExists = internalQuery({
  args: { txHash: v.string() },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const transactions = await ctx.db
      .query("transactions")
      .withIndex("by_status") // We'll filter in memory
      .collect();

    return transactions.some((t) => t.txHash === args.txHash);
  },
});

/**
 * Get transactions for a user within a time period (internal)
 */
export const getByUserForPeriod = internalQuery({
  args: {
    userId: v.id("users"),
    startDate: v.number(),
    endDate: v.number(),
  },
  handler: async (ctx, args) => {
    const transactions = await ctx.db
      .query("transactions")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    return transactions.filter(
      (t) => t.createdAt >= args.startDate && t.createdAt <= args.endDate
    );
  },
});
