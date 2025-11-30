import { v } from "convex/values";
import { internalMutation, internalQuery, query } from "./_generated/server";

/**
 * Rewards Management Module
 *
 * Tracks all Photon campaign rewards earned by users.
 */

// ============================================================================
// PUBLIC QUERIES
// ============================================================================

/**
 * Get all rewards for a user
 */
export const getByUser = query({
  args: { userId: v.id("users") },
  returns: v.array(
    v.object({
      _id: v.id("rewards"),
      _creationTime: v.number(),
      userId: v.id("users"),
      eventId: v.string(),
      eventType: v.string(),
      campaignId: v.string(),
      tokenAmount: v.number(),
      tokenSymbol: v.string(),
      credited: v.boolean(),
      triggeredAt: v.number(),
      creditedAt: v.optional(v.number()),
    })
  ),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("rewards")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect();
  },
});

/**
 * Get total rewards for a user
 */
export const getTotalByUser = query({
  args: { userId: v.id("users") },
  returns: v.object({
    totalAmount: v.number(),
    rewardCount: v.number(),
  }),
  handler: async (ctx, args) => {
    const rewards = await ctx.db
      .query("rewards")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    const totalAmount = rewards.reduce((sum, r) => sum + r.tokenAmount, 0);

    return {
      totalAmount,
      rewardCount: rewards.length,
    };
  },
});

/**
 * Get rewards by event type
 */
export const getByEventType = query({
  args: {
    userId: v.id("users"),
    eventType: v.string(),
  },
  returns: v.array(
    v.object({
      _id: v.id("rewards"),
      _creationTime: v.number(),
      eventId: v.string(),
      tokenAmount: v.number(),
      triggeredAt: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    const rewards = await ctx.db
      .query("rewards")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    return rewards
      .filter((r) => r.eventType === args.eventType)
      .map((r) => ({
        _id: r._id,
        _creationTime: r._creationTime,
        eventId: r.eventId,
        tokenAmount: r.tokenAmount,
        triggeredAt: r.triggeredAt,
      }));
  },
});

// ============================================================================
// INTERNAL MUTATIONS
// ============================================================================

/**
 * Record a new reward (called by Photon actions)
 */
export const recordReward = internalMutation({
  args: {
    userId: v.id("users"),
    eventId: v.string(),
    eventType: v.string(),
    campaignId: v.string(),
    tokenAmount: v.number(),
    tokenSymbol: v.string(),
  },
  returns: v.id("rewards"),
  handler: async (ctx, args) => {
    const now = Date.now();

    return await ctx.db.insert("rewards", {
      userId: args.userId,
      eventId: args.eventId,
      eventType: args.eventType,
      campaignId: args.campaignId,
      tokenAmount: args.tokenAmount,
      tokenSymbol: args.tokenSymbol,
      credited: true, // Photon credits immediately
      triggeredAt: now,
      creditedAt: now,
    });
  },
});

/**
 * Mark reward as credited
 */
export const markCredited = internalMutation({
  args: {
    rewardId: v.id("rewards"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.rewardId, {
      credited: true,
      creditedAt: Date.now(),
    });
    return null;
  },
});

// ============================================================================
// INTERNAL QUERIES
// ============================================================================

/**
 * Get uncredited rewards for a user
 */
export const getUncreditedByUser = internalQuery({
  args: { userId: v.id("users") },
  returns: v.array(
    v.object({
      _id: v.id("rewards"),
      eventId: v.string(),
      eventType: v.string(),
      tokenAmount: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    const rewards = await ctx.db
      .query("rewards")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    return rewards
      .filter((r) => !r.credited)
      .map((r) => ({
        _id: r._id,
        eventId: r.eventId,
        eventType: r.eventType,
        tokenAmount: r.tokenAmount,
      }));
  },
});

/**
 * Check if event was already processed (idempotency)
 */
export const eventExists = internalQuery({
  args: { eventId: v.string() },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("rewards")
      .withIndex("by_event_id", (q) => q.eq("eventId", args.eventId))
      .first();

    return existing !== null;
  },
});
