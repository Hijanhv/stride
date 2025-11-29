import { v } from "convex/values";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";

/**
 * SIP (Systematic Investment Plan) Management Module
 *
 * Handles creation, management, and querying of recurring investment plans.
 * Enhanced with DCA statistics tracking.
 */

// ============================================================================
// TYPE VALIDATORS (matching schema.ts)
// ============================================================================

const frequencyValidator = v.union(
  v.literal("hourly"),
  v.literal("daily"),
  v.literal("weekly"),
  v.literal("biweekly"),
  v.literal("monthly")
);

const statusValidator = v.union(
  v.literal("active"),
  v.literal("paused"),
  v.literal("cancelled"),
  v.literal("completed")
);

// Helper function to convert frequency to seconds
function frequencyToSeconds(frequency: string): number {
  switch (frequency) {
    case "hourly":
      return 60 * 60; // 3600
    case "daily":
      return 24 * 60 * 60; // 86400
    case "weekly":
      return 7 * 24 * 60 * 60; // 604800
    case "biweekly":
      return 14 * 24 * 60 * 60; // 1209600
    case "monthly":
      return 30 * 24 * 60 * 60; // 2592000
    default:
      return 24 * 60 * 60; // Default to daily
  }
}

// ============================================================================
// PUBLIC QUERIES
// ============================================================================

/**
 * Get all SIPs for a user
 */
export const getByUser = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("sips")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
  },
});

/**
 * Get active SIPs for a user
 */
export const getActiveByUser = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const sips = await ctx.db
      .query("sips")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    return sips.filter((sip) => sip.status === "active");
  },
});

/**
 * Get a single SIP by ID
 */
export const getById = query({
  args: { sipId: v.id("sips") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.sipId);
  },
});

/**
 * Get SIP statistics for a user
 */
export const getStats = query({
  args: { userId: v.id("users") },
  returns: v.object({
    totalSips: v.number(),
    activeSips: v.number(),
    totalInvested: v.number(),
    totalExecutions: v.number(),
  }),
  handler: async (ctx, args) => {
    const sips = await ctx.db
      .query("sips")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    const activeSips = sips.filter((s) => s.status === "active");
    const totalExecutions = sips.reduce((sum, s) => sum + s.executionCount, 0);
    const totalInvested = sips.reduce(
      (sum, s) => sum + (s.totalInvested || 0),
      0
    );

    return {
      totalSips: sips.length,
      activeSips: activeSips.length,
      totalInvested,
      totalExecutions,
    };
  },
});

/**
 * Get DCA statistics for a user
 */
export const getDCAStats = query({
  args: { userId: v.id("users") },
  returns: v.object({
    totalInvested: v.number(),
    totalReceived: v.number(),
    averagePrice: v.number(),
    totalExecutions: v.number(),
    successfulExecutions: v.number(),
    failedExecutions: v.number(),
    roi: v.number(),
  }),
  handler: async (ctx, args) => {
    const sips = await ctx.db
      .query("sips")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    let totalInvested = 0;
    let totalReceived = 0;
    let totalExecutions = 0;
    let successfulExecutions = 0;
    let failedExecutions = 0;

    for (const sip of sips) {
      totalInvested += sip.totalInvested || 0;
      totalReceived += sip.totalReceived || 0;
      totalExecutions += sip.executionCount || 0;
      successfulExecutions += sip.executionCount || 0;
      failedExecutions += sip.failedExecutions || 0;
    }

    // Calculate average price (scaled by 10^8 for precision)
    const averagePrice =
      totalReceived > 0
        ? Math.floor((totalInvested * 100000000) / totalReceived)
        : 0;

    // Calculate ROI (placeholder - would need current price from oracle)
    const roi = 0; // TODO: Calculate based on current market price

    return {
      totalInvested,
      totalReceived,
      averagePrice,
      totalExecutions,
      successfulExecutions,
      failedExecutions,
      roi,
    };
  },
});

/**
 * Get SIPs due for execution
 */
export const getDue = query({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const sips = await ctx.db
      .query("sips")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();

    return sips.filter((sip) => sip.nextExecution <= now);
  },
});

// ============================================================================
// PUBLIC MUTATIONS
// ============================================================================

/**
 * Create a new SIP
 */
export const create = mutation({
  args: {
    userId: v.id("users"),
    amount: v.number(),
    frequency: frequencyValidator,
    tokenSymbol: v.optional(v.string()),
    inputToken: v.optional(v.string()),
    targetToken: v.optional(v.string()),
    name: v.optional(v.string()),
  },
  returns: v.id("sips"),
  handler: async (ctx, args) => {
    const now = Date.now();
    const frequencySeconds = frequencyToSeconds(args.frequency);
    const nextExecution = now + frequencySeconds * 1000;

    return await ctx.db.insert("sips", {
      userId: args.userId,
      amount: args.amount,
      frequency: args.frequency,
      frequencySeconds,
      tokenSymbol: args.tokenSymbol || "APT",
      inputToken: args.inputToken,
      targetToken: args.targetToken,
      name: args.name,
      status: "active",
      nextExecution,
      executionCount: 0,
      totalInvested: 0,
      totalReceived: 0,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/**
 * Update SIP amount
 */
export const updateAmount = mutation({
  args: {
    sipId: v.id("sips"),
    amount: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.sipId, {
      amount: args.amount,
      updatedAt: Date.now(),
    });
    return null;
  },
});

/**
 * Update SIP frequency
 */
export const updateFrequency = mutation({
  args: {
    sipId: v.id("sips"),
    frequency: frequencyValidator,
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const sip = await ctx.db.get(args.sipId);
    if (!sip) return null;

    const now = Date.now();
    const frequencySeconds = frequencyToSeconds(args.frequency);
    const nextExecution = now + frequencySeconds * 1000;

    await ctx.db.patch(args.sipId, {
      frequency: args.frequency,
      frequencySeconds,
      nextExecution,
      updatedAt: now,
    });
    return null;
  },
});

/**
 * Pause a SIP
 */
export const pause = mutation({
  args: { sipId: v.id("sips") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.sipId, {
      status: "paused",
      updatedAt: Date.now(),
    });
    return null;
  },
});

/**
 * Resume a paused SIP
 */
export const resume = mutation({
  args: { sipId: v.id("sips") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const sip = await ctx.db.get(args.sipId);
    if (!sip || sip.status !== "paused") return null;

    const now = Date.now();
    const frequencySeconds = sip.frequencySeconds;

    // If nextExecution is in the past, schedule for next interval
    let nextExecution = sip.nextExecution;
    if (nextExecution < now) {
      nextExecution = now + frequencySeconds * 1000;
    }

    await ctx.db.patch(args.sipId, {
      status: "active",
      nextExecution,
      updatedAt: now,
    });
    return null;
  },
});

/**
 * Cancel a SIP
 */
export const cancel = mutation({
  args: { sipId: v.id("sips") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.sipId, {
      status: "cancelled",
      updatedAt: Date.now(),
    });
    return null;
  },
});

/**
 * Update SIP name
 */
export const updateName = mutation({
  args: {
    sipId: v.id("sips"),
    name: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.sipId, {
      name: args.name,
      updatedAt: Date.now(),
    });
    return null;
  },
});

// ============================================================================
// INTERNAL QUERIES
// ============================================================================

/**
 * Get SIP by ID (internal)
 */
export const getByIdInternal = internalQuery({
  args: { sipId: v.id("sips") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.sipId);
  },
});

/**
 * Get all SIPs for a user (internal)
 */
export const getByUserInternal = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("sips")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
  },
});

/**
 * Get SIPs due for execution (internal)
 */
export const getDueInternal = internalQuery({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const sips = await ctx.db
      .query("sips")
      .withIndex("by_status", (q) => q.eq("status", "active"))
      .collect();

    return sips.filter((sip) => sip.nextExecution <= now);
  },
});

// ============================================================================
// INTERNAL MUTATIONS
// ============================================================================

/**
 * Set vault address for a SIP (internal)
 */
export const setVaultAddress = internalMutation({
  args: {
    sipId: v.id("sips"),
    vaultAddress: v.string(),
    sipIndex: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.sipId, {
      vaultAddress: args.vaultAddress,
      sipIndex: args.sipIndex,
      updatedAt: Date.now(),
    });
    return null;
  },
});

/**
 * Update SIP after successful execution (internal)
 */
export const updateAfterExecution = internalMutation({
  args: {
    sipId: v.id("sips"),
    amountIn: v.number(),
    amountOut: v.number(),
    txHash: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const sip = await ctx.db.get(args.sipId);
    if (!sip) return null;

    const now = Date.now();
    const totalInvested = (sip.totalInvested || 0) + args.amountIn;
    const totalReceived = (sip.totalReceived || 0) + args.amountOut;

    // Calculate next execution based on frequency
    const nextExecution = now + sip.frequencySeconds * 1000;

    // Calculate average price (scaled by 10^8)
    const averagePrice =
      totalReceived > 0
        ? Math.floor((totalInvested * 100000000) / totalReceived)
        : 0;

    await ctx.db.patch(args.sipId, {
      totalInvested,
      totalReceived,
      averagePrice,
      executionCount: sip.executionCount + 1,
      lastExecutedAt: now,
      nextExecution,
      updatedAt: now,
    });

    return null;
  },
});

/**
 * Record failed execution (internal)
 */
export const recordFailedExecution = internalMutation({
  args: {
    sipId: v.id("sips"),
    errorMessage: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const sip = await ctx.db.get(args.sipId);
    if (!sip) return null;

    const now = Date.now();
    const failedExecutions = (sip.failedExecutions || 0) + 1;

    // If too many failures, pause the SIP
    const status = failedExecutions >= 3 ? "paused" : sip.status;

    await ctx.db.patch(args.sipId, {
      failedExecutions,
      status,
      updatedAt: now,
    });

    return null;
  },
});

/**
 * Update ROI for a SIP (internal)
 */
export const updateROI = internalMutation({
  args: {
    sipId: v.id("sips"),
    currentPrice: v.number(), // Current market price of target token
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const sip = await ctx.db.get(args.sipId);
    if (!sip || !sip.totalReceived || !sip.totalInvested) return null;

    // Calculate current value
    const currentValue = sip.totalReceived * args.currentPrice;

    // Calculate ROI percentage
    const roi =
      sip.totalInvested > 0
        ? Math.floor(
            ((currentValue - sip.totalInvested) / sip.totalInvested) * 10000
          ) // Scaled by 100 for percentage with 2 decimal places
        : 0;

    await ctx.db.patch(args.sipId, {
      roi,
      updatedAt: Date.now(),
    });

    return null;
  },
});
