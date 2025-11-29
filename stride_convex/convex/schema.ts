import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Rupaya Rail Database Schema
 *
 * This schema defines the data structure for the Rupaya Rail application,
 * which integrates with Photon API for embedded wallet management and
 * reward distribution on Aptos Testnet.
 */
export default defineSchema({
  /**
   * Users Table
   * Stores user information including Photon wallet integration data.
   *
   * Photon API Integration:
   * - walletAddress: Embedded wallet on Aptos Testnet (from Photon)
   * - photonId: UUID returned from Photon /identity/register
   * - accessToken: Bearer token for authenticated Photon API calls
   * - refreshToken: Token to refresh access_token when expired
   */
  users: defineTable({
    // Core user identity
    phone: v.string(),
    name: v.optional(v.string()),
    email: v.optional(v.string()),

    // Photon Integration (from /identity/register response)
    walletAddress: v.optional(v.string()), // Aptos Testnet embedded wallet
    photonId: v.optional(v.string()), // UUID from Photon: data.user.user.id
    accessToken: v.optional(v.string()), // Bearer token: data.tokens.access_token
    refreshToken: v.optional(v.string()), // Refresh token: data.tokens.refresh_token
    tokenExpiresAt: v.optional(v.number()), // When access token expires

    // Timestamps
    createdAt: v.number(),
    lastLoginAt: v.optional(v.number()),
  })
    .index("by_phone", ["phone"])
    .index("by_wallet", ["walletAddress"])
    .index("by_photon_id", ["photonId"]),

  /**
   * SIPs (Systematic Investment Plans) Table
   * Stores recurring investment configurations for users.
   */
  sips: defineTable({
    userId: v.id("users"),

    // SIP Configuration
    amount: v.number(), // Amount in base currency (INR paise or tokens)
    frequency: v.union(
      // Execution frequency
      v.literal("daily"),
      v.literal("weekly"),
      v.literal("monthly")
    ),

    // Token/Asset Information
    tokenAddress: v.optional(v.string()), // Target token address on Aptos
    tokenSymbol: v.optional(v.string()), // Token symbol (e.g., "APT", "PHOTON")

    // Vault Configuration (for CLOB market integration)
    vaultAddress: v.optional(v.string()), // On-chain vault address

    // Status & Scheduling
    status: v.union(
      v.literal("active"),
      v.literal("paused"),
      v.literal("cancelled"),
      v.literal("completed")
    ),
    nextExecution: v.number(), // Timestamp of next scheduled execution
    lastExecutedAt: v.optional(v.number()), // Last successful execution timestamp
    executionCount: v.number(), // Total successful executions

    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_status", ["status"])
    .index("by_next_execution", ["nextExecution"]),

  /**
   * Transactions Table
   * Records all financial transactions including deposits, SIP executions, and rewards.
   */
  transactions: defineTable({
    userId: v.id("users"),
    sipId: v.optional(v.id("sips")), // Reference to SIP if this is a SIP execution

    // Transaction Type
    type: v.union(
      v.literal("deposit"), // UPI deposit to platform
      v.literal("withdrawal"), // Withdrawal from platform
      v.literal("sip_execution"), // Automated SIP purchase
      v.literal("reward"), // Photon reward earned
      v.literal("swap") // Token swap on CLOB
    ),

    // Amount & Token Info
    amount: v.number(), // Transaction amount
    tokenSymbol: v.optional(v.string()), // Token involved
    tokenAddress: v.optional(v.string()), // Token contract address

    // Status
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("success"),
      v.literal("failed")
    ),

    // Blockchain Transaction Details
    txHash: v.optional(v.string()), // Aptos transaction hash
    blockNumber: v.optional(v.number()), // Block number on Aptos

    // Error Handling
    errorMessage: v.optional(v.string()), // Error message if failed

    // Timestamps
    createdAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_sip", ["sipId"])
    .index("by_type", ["type"])
    .index("by_status", ["status"])
    .index("by_user_and_type", ["userId", "type"]),

  /**
   * Rewards Table
   * Tracks Photon campaign rewards earned by users.
   */
  rewards: defineTable({
    userId: v.id("users"),

    // Photon Campaign Event Details
    eventId: v.string(), // Unique event ID sent to Photon
    eventType: v.string(), // e.g., "game_win", "daily_login", "sip_execution"
    campaignId: v.string(), // Photon campaign ID

    // Reward Details
    tokenAmount: v.number(), // Amount of PHOTON tokens earned
    tokenSymbol: v.string(), // Token symbol (usually "PHOTON")

    // Status
    credited: v.boolean(), // Whether reward was successfully credited

    // Timestamps
    triggeredAt: v.number(), // When event was triggered
    creditedAt: v.optional(v.number()), // When reward was credited to wallet
  })
    .index("by_user", ["userId"])
    .index("by_event_id", ["eventId"])
    .index("by_event_type", ["eventType"]),

  /**
   * User Balances Table
   * Cached balance information for quick access (on-chain source of truth).
   */
  balances: defineTable({
    userId: v.id("users"),

    // Balance Information
    tokenSymbol: v.string(), // Token symbol (e.g., "APT", "PHOTON", "INR")
    tokenAddress: v.optional(v.string()), // Token address (null for fiat)
    balance: v.number(), // Current balance

    // Cache Metadata
    lastSyncedAt: v.number(), // When balance was last synced from chain
    isStale: v.boolean(), // Whether balance needs refresh
  })
    .index("by_user", ["userId"])
    .index("by_user_and_token", ["userId", "tokenSymbol"]),

  /**
   * Audit Logs Table
   * Comprehensive logging for debugging and compliance.
   */
  auditLogs: defineTable({
    userId: v.optional(v.id("users")), // Optional: system events may not have user

    // Event Classification
    action: v.string(), // Action performed
    resource: v.string(), // Resource affected (e.g., "user", "sip", "transaction")
    resourceId: v.optional(v.string()), // ID of affected resource

    // Request/Response Data
    requestData: v.optional(v.string()), // JSON stringified request data
    responseData: v.optional(v.string()), // JSON stringified response data

    // Metadata
    ipAddress: v.optional(v.string()),
    userAgent: v.optional(v.string()),

    // Outcome
    success: v.boolean(),
    errorMessage: v.optional(v.string()),

    // Timestamp
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_action", ["action"])
    .index("by_resource", ["resource"]),
});
