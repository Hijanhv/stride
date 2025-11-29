import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Stride Database Schema
 *
 * This schema defines the data structure for the Stride DCA application,
 * integrating with Photon API for embedded wallet management,
 * Geomi for gasless transactions, and Shelby for receipt storage.
 */
export default defineSchema({
  /**
   * Users Table
   * Stores user information including Photon wallet integration data.
   */
  users: defineTable({
    // Core user identity
    phone: v.string(),
    name: v.optional(v.string()),
    email: v.optional(v.string()),

    // Photon Integration (from /identity/register response)
    walletAddress: v.optional(v.string()), // Aptos embedded wallet
    photonId: v.optional(v.string()), // UUID from Photon
    accessToken: v.optional(v.string()), // Bearer token
    refreshToken: v.optional(v.string()), // Refresh token
    tokenExpiresAt: v.optional(v.number()), // When access token expires

    // On-chain Vault Reference
    vaultAddress: v.optional(v.string()), // User's sip_vault object address
    vaultCreatedAt: v.optional(v.number()), // When vault was created

    // DCA Statistics (cached from chain)
    totalInvested: v.optional(v.number()), // Total amount invested via DCA
    totalTokensReceived: v.optional(v.number()), // Total tokens received
    averagePrice: v.optional(v.number()), // Average purchase price

    // Reward Statistics
    rewardPoints: v.optional(v.number()), // Current reward points
    rewardTier: v.optional(v.number()), // Tier level (0-5)
    streakDays: v.optional(v.number()), // Current streak

    // Settings
    notificationsEnabled: v.optional(v.boolean()),
    preferredFrequency: v.optional(v.string()),

    // Timestamps
    createdAt: v.number(),
    lastLoginAt: v.optional(v.number()),
    lastSyncedAt: v.optional(v.number()), // Last chain sync
  })
    .index("by_phone", ["phone"])
    .index("by_wallet", ["walletAddress"])
    .index("by_photon_id", ["photonId"])
    .index("by_vault", ["vaultAddress"]),

  /**
   * SIPs (Systematic Investment Plans) Table
   * Stores recurring investment configurations for users.
   */
  sips: defineTable({
    userId: v.id("users"),

    // SIP Configuration
    amount: v.number(), // Amount in base currency (USDC with 6 decimals)
    frequency: v.union(
      v.literal("hourly"), // For testing
      v.literal("daily"),
      v.literal("weekly"),
      v.literal("biweekly"),
      v.literal("monthly")
    ),
    frequencySeconds: v.number(), // Actual frequency in seconds

    // Token/Asset Information
    inputToken: v.optional(v.string()), // Input token address (USDC)
    targetToken: v.optional(v.string()), // Target token address (APT)
    tokenSymbol: v.optional(v.string()), // Token symbol (e.g., "APT")

    // Vault Configuration (for CLOB market integration)
    vaultAddress: v.optional(v.string()), // On-chain vault address
    sipIndex: v.optional(v.number()), // Index in the vault's SIP array

    // DCA Statistics
    totalInvested: v.number(), // Total amount invested
    totalReceived: v.number(), // Total tokens received
    averagePrice: v.optional(v.number()), // Average price paid
    roi: v.optional(v.number()), // Return on investment percentage

    // Status & Scheduling
    status: v.union(
      v.literal("active"),
      v.literal("paused"),
      v.literal("cancelled"),
      v.literal("completed")
    ),
    nextExecution: v.number(), // Timestamp of next scheduled execution
    lastExecutedAt: v.optional(v.number()), // Last successful execution
    executionCount: v.number(), // Total successful executions
    failedExecutions: v.optional(v.number()), // Failed execution count

    // Name/Label
    name: v.optional(v.string()), // User-defined name for the SIP

    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_status", ["status"])
    .index("by_next_execution", ["nextExecution"])
    .index("by_user_and_status", ["userId", "status"]),

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
    amountOut: v.optional(v.number()), // Output amount (for swaps)
    tokenSymbol: v.optional(v.string()), // Token involved
    tokenAddress: v.optional(v.string()), // Token contract address
    outputTokenSymbol: v.optional(v.string()), // Output token (for swaps)

    // Price Information (for DCA tracking)
    price: v.optional(v.number()), // Execution price
    priceUsd: v.optional(v.number()), // USD equivalent

    // Status
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("success"),
      v.literal("failed")
    ),

    // Blockchain Transaction Details
    txHash: v.optional(v.string()), // Aptos transaction hash
    blockNumber: v.optional(v.number()), // Block number
    gasUsed: v.optional(v.number()), // Gas used
    gasSponsored: v.optional(v.boolean()), // Whether gas was sponsored

    // Shelby Receipt Storage
    receiptBlobName: v.optional(v.string()), // Shelby blob name for receipt
    receiptUrl: v.optional(v.string()), // URL to download receipt

    // Error Handling
    errorMessage: v.optional(v.string()), // Error message if failed
    retryCount: v.optional(v.number()), // Number of retries

    // Timestamps
    createdAt: v.number(),
    completedAt: v.optional(v.number()),
  })
    .index("by_user", ["userId"])
    .index("by_sip", ["sipId"])
    .index("by_type", ["type"])
    .index("by_status", ["status"])
    .index("by_user_and_type", ["userId", "type"])
    .index("by_tx_hash", ["txHash"]),

  /**
   * Rewards Table
   * Tracks Photon campaign rewards earned by users.
   */
  rewards: defineTable({
    userId: v.id("users"),

    // Photon Campaign Event Details
    eventId: v.string(), // Unique event ID sent to Photon
    eventType: v.string(), // e.g., "sip_execution", "daily_login", "streak_bonus"
    campaignId: v.string(), // Photon campaign ID

    // Reward Details
    tokenAmount: v.number(), // Amount of PHOTON tokens earned
    tokenSymbol: v.string(), // Token symbol (usually "PHOTON")
    pointsAwarded: v.optional(v.number()), // On-chain points added

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
    tokenSymbol: v.string(), // Token symbol (e.g., "APT", "USDC", "PHOTON")
    tokenAddress: v.optional(v.string()), // Token address (null for fiat)
    balance: v.number(), // Current balance
    balanceUsd: v.optional(v.number()), // USD equivalent

    // Cache Metadata
    lastSyncedAt: v.number(), // When balance was last synced from chain
    isStale: v.boolean(), // Whether balance needs refresh
  })
    .index("by_user", ["userId"])
    .index("by_user_and_token", ["userId", "tokenSymbol"]),

  /**
   * Receipts Table
   * Stores references to receipts stored on Shelby for compliance/audit.
   */
  receipts: defineTable({
    userId: v.id("users"),
    transactionId: v.optional(v.id("transactions")),
    sipId: v.optional(v.id("sips")),

    // Receipt Type
    type: v.union(
      v.literal("sip_execution"),
      v.literal("deposit"),
      v.literal("withdrawal"),
      v.literal("monthly_report"),
      v.literal("tax_summary")
    ),

    // Shelby Storage
    blobName: v.string(), // Shelby blob identifier
    blobUrl: v.optional(v.string()), // URL to download
    contentType: v.string(), // e.g., "application/json", "application/pdf"
    fileSize: v.optional(v.number()), // Size in bytes

    // Receipt Data Summary
    summary: v.optional(v.string()), // JSON stringified summary
    period: v.optional(v.string()), // e.g., "2024-01" for monthly reports

    // Timestamps
    createdAt: v.number(),
    expiresAt: v.optional(v.number()), // When the blob expires (if applicable)
  })
    .index("by_user", ["userId"])
    .index("by_transaction", ["transactionId"])
    .index("by_type", ["type"])
    .index("by_blob_name", ["blobName"]),

  /**
   * DCA Analytics Table
   * Aggregated DCA statistics per user per token.
   */
  dcaAnalytics: defineTable({
    userId: v.id("users"),
    tokenSymbol: v.string(),

    // Investment Stats
    totalInvested: v.number(), // Total amount invested (in USDC)
    totalReceived: v.number(), // Total tokens received
    averagePrice: v.number(), // Average price paid (scaled by 10^8)

    // Performance
    currentValue: v.optional(v.number()), // Current value in USDC
    roi: v.optional(v.number()), // Return on investment percentage
    unrealizedPnl: v.optional(v.number()), // Unrealized P&L

    // Execution Stats
    totalExecutions: v.number(),
    successfulExecutions: v.number(),
    failedExecutions: v.number(),

    // Time-weighted stats
    firstExecutionAt: v.optional(v.number()),
    lastExecutionAt: v.optional(v.number()),

    // Last updated
    updatedAt: v.number(),
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
    resource: v.string(), // Resource affected
    resourceId: v.optional(v.string()), // ID of affected resource

    // Request/Response Data
    requestData: v.optional(v.string()), // JSON stringified request data
    responseData: v.optional(v.string()), // JSON stringified response data

    // Blockchain Context
    txHash: v.optional(v.string()),
    blockNumber: v.optional(v.number()),

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
    .index("by_resource", ["resource"])
    .index("by_tx_hash", ["txHash"]),

  /**
   * Scheduled Jobs Table
   * Tracks scheduled cron jobs and their execution status.
   */
  scheduledJobs: defineTable({
    jobType: v.string(), // e.g., "sip_execution", "balance_sync", "report_generation"

    // Execution Details
    lastRunAt: v.optional(v.number()),
    nextRunAt: v.optional(v.number()),

    // Stats
    totalRuns: v.number(),
    successfulRuns: v.number(),
    failedRuns: v.number(),

    // Last Run Details
    lastRunDuration: v.optional(v.number()), // ms
    lastRunResult: v.optional(v.string()), // JSON stringified
    lastError: v.optional(v.string()),

    // Status
    status: v.union(
      v.literal("idle"),
      v.literal("running"),
      v.literal("failed"),
      v.literal("disabled")
    ),

    // Timestamps
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_job_type", ["jobType"])
    .index("by_status", ["status"]),
});
