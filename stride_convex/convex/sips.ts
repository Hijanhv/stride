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
 */

// ============================================================================
// TYPE VALIDATORS
// ============================================================================

const frequencyValidator = v.union(
  v.literal("daily"),
  v.literal("weekly"),
  v.literal("monthly")
);

const statusValidator = v.union(
  v.literal("active"),
  v.literal("paused"),
  v.literal("cancelled"),
  v.literal("completed")
);

const sipReturnValidator = v.object({
  _id: v.id("sips"),
  _creationTime: v.number(),
  userId: v.id("users"),
  amount: v.number(),
  frequency: frequencyValidator,
  tokenAddress: v.optional(v.string()),
  tokenSymbol: v.optional(v.string()),
  vaultAddress: v.optional(v.string()),
  status: statusValidator,
  nextExecution: v.number(),
  lastExecutedAt: v.optional(v.number()),
  executionCount: v.number(),
  createdAt: v.number(),
  updatedAt: v.number(),
});

// ============================================================================
// PUBLIC QUERIES
// ============================================================================

/**
 * Get all SIPs for a user
 */
export const getByUser = query({
  args: { userId: v.id("users") },
  returns: v.array(sipReturnValidator),
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
  returns: v.array(sipReturnValidator),
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
  returns: v.union(sipReturnValidator, v.null()),
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
      (sum, s) => sum + s.amount * s.executionCount,
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
    tokenAddress: v.optional(v.string()),
  },
  returns: v.id("sips"),
  handler: async (ctx, args) => {
    const now = Date.now();

    // Calculate first execution time based on frequency
    let nextExecution: number;
    switch (args.frequency) {
      case "daily":
        nextExecution = now + 24 * 60 * 60 * 1000;
        break;
      case "weekly":
        nextExecution = now + 7 * 24 * 60 * 60 * 1000;
        break;
      case "monthly":
        nextExecution = now + 30 * 24 * 60 * 60 * 1000;
        break;
      default:
        nextExecution = now + 24 * 60 * 60 * 1000;
    }

    return await ctx.db.insert("sips", {
      userId: args.userId,
      amount: args.amount,
      frequency: args.frequency,
      tokenSymbol: args.tokenSymbol || "APT",
      tokenAddress: args.tokenAddress,
      status: "active",
      nextExecution,
      executionCount: 0,
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

    // Recalculate next execution based on new frequency
    let nextExecution: number;
    switch (args.frequency) {
      case "daily":
        nextExecution = now + 24 * 60 * 60 * 1000;
        break;
      case "weekly":
        nextExecution = now + 7 * 24 * 60 * 60 * 1000;
        break;
      case "monthly":
        nextExecution = now + 30 * 24 * 60 * 60 * 1000;
        break;
      default:
        nextExecution = now + 24 * 60 * 60 * 1000;
    }

    await ctx.db.patch(args.sipId, {
      frequency: args.frequency,
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

    // If nextExecution is in the past, schedule for next interval
    let nextExecution = sip.nextExecution;
    if (nextExecution < now) {
      switch (sip.frequency) {
        case "daily":
          nextExecution = now + 24 * 60 * 60 * 1000;
          break;
        case "weekly":
          nextExecution = now + 7 * 24 * 60 * 60 * 1000;
          break;
        case "monthly":
          nextExecution = now + 30 * 24 * 60 * 60 * 1000;
          break;
      }
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

// ============================================================================
// INTERNAL QUERIES
// ============================================================================

/**
 * Get SIP by ID (internal)
 */
export const getByIdInternal = internalQuery({
  args: { sipId: v.id("sips") },
  returns: v.union(sipReturnValidator, v.null()),
  handler: async (ctx, args) => {
    return await ctx.db.get(args.sipId);
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
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.sipId, {
      vaultAddress: args.vaultAddress,
      updatedAt: Date.now(),
    });
    return null;
  },
});
