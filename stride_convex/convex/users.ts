import { v } from "convex/values";
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from "./_generated/server";

/**
 * User Management Module
 *
 * Handles user registration, authentication, and profile management.
 * Integrates with Photon API for embedded wallet creation.
 */

// ============================================================================
// PUBLIC QUERIES
// ============================================================================

/**
 * Get user by phone number
 */
export const getByPhone = query({
  args: { phone: v.string() },
  returns: v.union(
    v.object({
      _id: v.id("users"),
      _creationTime: v.number(),
      phone: v.string(),
      name: v.optional(v.string()),
      email: v.optional(v.string()),
      walletAddress: v.optional(v.string()),
      photonId: v.optional(v.string()),
      createdAt: v.number(),
      lastLoginAt: v.optional(v.number()),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_phone", (q) => q.eq("phone", args.phone))
      .first();

    if (!user) return null;

    // Return user without sensitive data
    return {
      _id: user._id,
      _creationTime: user._creationTime,
      phone: user.phone,
      name: user.name,
      email: user.email,
      walletAddress: user.walletAddress,
      photonId: user.photonId,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
    };
  },
});

/**
 * Get user by ID
 */
export const getById = query({
  args: { userId: v.id("users") },
  returns: v.union(
    v.object({
      _id: v.id("users"),
      _creationTime: v.number(),
      phone: v.string(),
      name: v.optional(v.string()),
      email: v.optional(v.string()),
      walletAddress: v.optional(v.string()),
      photonId: v.optional(v.string()),
      createdAt: v.number(),
      lastLoginAt: v.optional(v.number()),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);

    if (!user) return null;

    return {
      _id: user._id,
      _creationTime: user._creationTime,
      phone: user.phone,
      name: user.name,
      email: user.email,
      walletAddress: user.walletAddress,
      photonId: user.photonId,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
    };
  },
});

/**
 * Get user's wallet address
 */
export const getWalletAddress = query({
  args: { userId: v.id("users") },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    return user?.walletAddress ?? null;
  },
});

/**
 * Check if user has completed Photon onboarding
 */
export const hasPhotonWallet = query({
  args: { userId: v.id("users") },
  returns: v.boolean(),
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    return !!(user?.walletAddress && user?.photonId);
  },
});

// ============================================================================
// PUBLIC MUTATIONS
// ============================================================================

/**
 * Create a new user (before Photon onboarding)
 */
export const create = mutation({
  args: {
    phone: v.string(),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
  },
  returns: v.id("users"),
  handler: async (ctx, args) => {
    // Check if user already exists
    const existing = await ctx.db
      .query("users")
      .withIndex("by_phone", (q) => q.eq("phone", args.phone))
      .first();

    if (existing) {
      return existing._id;
    }

    // Create new user
    const now = Date.now();
    return await ctx.db.insert("users", {
      phone: args.phone,
      name: args.name,
      email: args.email,
      createdAt: now,
    });
  },
});

/**
 * Update user profile
 */
export const updateProfile = mutation({
  args: {
    userId: v.id("users"),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { userId, ...updates } = args;

    // Filter out undefined values
    const filteredUpdates: { name?: string; email?: string } = {};
    if (updates.name !== undefined) filteredUpdates.name = updates.name;
    if (updates.email !== undefined) filteredUpdates.email = updates.email;

    if (Object.keys(filteredUpdates).length > 0) {
      await ctx.db.patch(userId, filteredUpdates);
    }

    return null;
  },
});

/**
 * Update last login timestamp
 */
export const recordLogin = mutation({
  args: { userId: v.id("users") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, {
      lastLoginAt: Date.now(),
    });
    return null;
  },
});

// ============================================================================
// INTERNAL QUERIES (for actions and other internal use)
// ============================================================================

/**
 * Get user by phone (internal - includes access token)
 */
export const getByPhoneInternal = internalQuery({
  args: { phone: v.string() },
  returns: v.union(
    v.object({
      _id: v.id("users"),
      phone: v.string(),
      name: v.optional(v.string()),
      walletAddress: v.optional(v.string()),
      photonId: v.optional(v.string()),
      accessToken: v.optional(v.string()),
      refreshToken: v.optional(v.string()),
      tokenExpiresAt: v.optional(v.number()),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_phone", (q) => q.eq("phone", args.phone))
      .first();

    if (!user) return null;

    return {
      _id: user._id,
      phone: user.phone,
      name: user.name,
      walletAddress: user.walletAddress,
      photonId: user.photonId,
      accessToken: user.accessToken,
      refreshToken: user.refreshToken,
      tokenExpiresAt: user.tokenExpiresAt,
    };
  },
});

/**
 * Get user by ID (internal - includes access token)
 */
export const getByIdInternal = internalQuery({
  args: { userId: v.id("users") },
  returns: v.union(
    v.object({
      _id: v.id("users"),
      phone: v.string(),
      name: v.optional(v.string()),
      walletAddress: v.optional(v.string()),
      photonId: v.optional(v.string()),
      accessToken: v.optional(v.string()),
      refreshToken: v.optional(v.string()),
      tokenExpiresAt: v.optional(v.number()),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);

    if (!user) return null;

    return {
      _id: user._id,
      phone: user.phone,
      name: user.name,
      walletAddress: user.walletAddress,
      photonId: user.photonId,
      accessToken: user.accessToken,
      refreshToken: user.refreshToken,
      tokenExpiresAt: user.tokenExpiresAt,
    };
  },
});

// ============================================================================
// INTERNAL MUTATIONS (for actions to write data)
// ============================================================================

/**
 * Update user with Photon wallet data after registration
 */
export const updatePhotonData = internalMutation({
  args: {
    userId: v.id("users"),
    walletAddress: v.string(),
    photonId: v.string(),
    accessToken: v.string(),
    refreshToken: v.optional(v.string()),
    tokenExpiresAt: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, {
      walletAddress: args.walletAddress,
      photonId: args.photonId,
      accessToken: args.accessToken,
      refreshToken: args.refreshToken,
      tokenExpiresAt: args.tokenExpiresAt,
    });
    return null;
  },
});

/**
 * Refresh access token
 */
export const updateAccessToken = internalMutation({
  args: {
    userId: v.id("users"),
    accessToken: v.string(),
    tokenExpiresAt: v.number(),
    refreshToken: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const updates: {
      accessToken: string;
      tokenExpiresAt: number;
      refreshToken?: string;
    } = {
      accessToken: args.accessToken,
      tokenExpiresAt: args.tokenExpiresAt,
    };

    if (args.refreshToken) {
      updates.refreshToken = args.refreshToken;
    }

    await ctx.db.patch(args.userId, updates);
    return null;
  },
});

/**
 * Create user with Photon data (for action-based registration)
 */
export const createWithPhoton = internalMutation({
  args: {
    phone: v.string(),
    walletAddress: v.string(),
    photonId: v.string(),
    accessToken: v.string(),
    refreshToken: v.optional(v.string()),
    tokenExpiresAt: v.number(),
  },
  returns: v.id("users"),
  handler: async (ctx, args) => {
    // Check if user already exists
    const existing = await ctx.db
      .query("users")
      .withIndex("by_phone", (q) => q.eq("phone", args.phone))
      .first();

    if (existing) {
      // Update existing user with Photon data
      await ctx.db.patch(existing._id, {
        walletAddress: args.walletAddress,
        photonId: args.photonId,
        accessToken: args.accessToken,
        refreshToken: args.refreshToken,
        tokenExpiresAt: args.tokenExpiresAt,
      });
      return existing._id;
    }

    // Create new user with Photon data
    const now = Date.now();
    return await ctx.db.insert("users", {
      phone: args.phone,
      walletAddress: args.walletAddress,
      photonId: args.photonId,
      accessToken: args.accessToken,
      refreshToken: args.refreshToken,
      tokenExpiresAt: args.tokenExpiresAt,
      createdAt: now,
    });
  },
});
