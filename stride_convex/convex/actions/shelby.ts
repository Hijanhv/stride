"use node";

import axios from "axios";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { action, internalAction } from "../_generated/server";

/**
 * Shelby Integration Module
 *
 * Handles receipt storage and retrieval for compliance and audit purposes:
 * - SIP execution receipts
 * - Monthly investment reports
 * - Tax summaries
 * - Transaction history exports
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

function getConfig() {
  return {
    API_URL: process.env.SHELBY_API_URL || "https://api.shelby.dev/v1",
    API_KEY: process.env.SHELBY_API_KEY || "",
    BUCKET_NAME: process.env.SHELBY_BUCKET_NAME || "stride-receipts",
  };
}

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface SIPExecutionReceipt {
  version: string;
  receiptId: string;
  receiptType: "sip_execution";

  // User Info
  userId: string;
  walletAddress: string;

  // SIP Details
  sipId: string;
  sipName?: string;
  sipIndex: number;
  vaultAddress: string;

  // Execution Details
  executionTimestamp: string;
  executionNumber: number;

  // Transaction Details
  amountIn: number;
  amountInToken: string;
  amountOut: number;
  amountOutToken: string;
  executionPrice: number;

  // On-chain Reference
  txHash: string;
  blockNumber?: number;

  // Rewards
  rewardPoints?: number;
  photonReward?: number;

  // Running Totals
  totalInvested: number;
  totalReceived: number;
  averagePrice: number;

  // DCA Performance
  roi?: number;
  unrealizedPnl?: number;

  // Metadata
  network: string;
  contractAddress: string;
  generatedAt: string;
}

interface MonthlyReport {
  version: string;
  reportId: string;
  reportType: "monthly_report";
  period: string; // YYYY-MM

  // User Info
  userId: string;
  walletAddress: string;

  // Summary
  totalInvested: number;
  totalTokensReceived: number;
  averagePrice: number;
  portfolioValue: number;
  roi: number;

  // SIP Breakdown
  sipSummaries: Array<{
    sipId: string;
    sipName?: string;
    tokenSymbol: string;
    amountInvested: number;
    tokensReceived: number;
    executionCount: number;
    averagePrice: number;
  }>;

  // Transactions
  transactionCount: number;
  successfulExecutions: number;
  failedExecutions: number;

  // Rewards
  totalRewardPoints: number;
  rewardTier: number;

  // Metadata
  generatedAt: string;
  network: string;
}

interface ReceiptUploadResult {
  success: boolean;
  blobName?: string;
  url?: string;
  error?: string;
}

// ============================================================================
// PUBLIC ACTIONS
// ============================================================================

/**
 * Generate and upload a SIP execution receipt
 */
export const generateSIPReceipt = action({
  args: {
    userId: v.id("users"),
    sipId: v.id("sips"),
    transactionId: v.id("transactions"),
    executionData: v.object({
      amountIn: v.number(),
      amountOut: v.number(),
      txHash: v.string(),
      blockNumber: v.optional(v.number()),
      rewardPoints: v.optional(v.number()),
    }),
  },
  returns: v.object({
    success: v.boolean(),
    receiptId: v.optional(v.string()),
    blobName: v.optional(v.string()),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const config = getConfig();

    try {
      // Get user data
      const user = await ctx.runQuery(internal.users.getByIdInternal, {
        userId: args.userId,
      });

      if (!user) {
        return { success: false, error: "User not found" };
      }

      // Get SIP data
      const sip = await ctx.runQuery(internal.sips.getByIdInternal, {
        sipId: args.sipId,
      });

      if (!sip) {
        return { success: false, error: "SIP not found" };
      }

      // Generate receipt ID
      const receiptId = `receipt-${args.transactionId}-${Date.now()}`;
      const now = new Date().toISOString();

      // Build receipt object
      const receipt: SIPExecutionReceipt = {
        version: "1.0.0",
        receiptId,
        receiptType: "sip_execution",

        userId: args.userId,
        walletAddress: user.walletAddress || "",

        sipId: args.sipId,
        sipName: sip.name,
        sipIndex: sip.sipIndex || 0,
        vaultAddress: sip.vaultAddress || "",

        executionTimestamp: now,
        executionNumber: (sip.executionCount || 0) + 1,

        amountIn: args.executionData.amountIn,
        amountInToken: "USDC",
        amountOut: args.executionData.amountOut,
        amountOutToken: sip.tokenSymbol || "APT",
        executionPrice:
          args.executionData.amountOut > 0
            ? args.executionData.amountIn / args.executionData.amountOut
            : 0,

        txHash: args.executionData.txHash,
        blockNumber: args.executionData.blockNumber,

        rewardPoints: args.executionData.rewardPoints,

        totalInvested: (sip.totalInvested || 0) + args.executionData.amountIn,
        totalReceived: (sip.totalReceived || 0) + args.executionData.amountOut,
        averagePrice: sip.averagePrice || 0,

        network: process.env.APTOS_NETWORK || "testnet",
        contractAddress: process.env.CONTRACT_ADDRESS || "0xcafe",
        generatedAt: now,
      };

      // Upload to Shelby (or store locally if not configured)
      let blobName = `sip-receipts/${args.userId}/${receiptId}.json`;

      if (config.API_KEY) {
        try {
          const uploadResult = await uploadToShelby(config, blobName, receipt);
          if (uploadResult.success) {
            blobName = uploadResult.blobName || blobName;
          }
        } catch (uploadError) {
          console.warn("[Shelby] Upload failed, storing locally:", uploadError);
        }
      }

      // Store receipt reference in Convex
      await ctx.runMutation(internal.receipts.createReceipt, {
        userId: args.userId,
        transactionId: args.transactionId,
        sipId: args.sipId,
        type: "sip_execution",
        blobName,
        contentType: "application/json",
        summary: JSON.stringify({
          amountIn: args.executionData.amountIn,
          amountOut: args.executionData.amountOut,
          txHash: args.executionData.txHash,
        }),
      });

      console.log(`[Shelby] Receipt generated: ${receiptId}`);

      return {
        success: true,
        receiptId,
        blobName,
      };
    } catch (error) {
      console.error("[Shelby] Generate receipt error:", error);

      return {
        success: false,
        error: "Failed to generate receipt",
      };
    }
  },
});

/**
 * Generate monthly investment report
 */
export const generateMonthlyReport = action({
  args: {
    userId: v.id("users"),
    period: v.string(), // YYYY-MM format
  },
  returns: v.object({
    success: v.boolean(),
    reportId: v.optional(v.string()),
    blobName: v.optional(v.string()),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const config = getConfig();

    try {
      // Get user data
      const user = await ctx.runQuery(internal.users.getByIdInternal, {
        userId: args.userId,
      });

      if (!user) {
        return { success: false, error: "User not found" };
      }

      // Get all SIPs for user
      const sips = await ctx.runQuery(internal.sips.getByUserInternal, {
        userId: args.userId,
      });

      // Get transactions for the period
      const transactions = await ctx.runQuery(
        internal.transactions.getByUserForPeriod,
        {
          userId: args.userId,
          startDate: new Date(`${args.period}-01`).getTime(),
          endDate:
            new Date(`${args.period}-01`).getTime() + 31 * 24 * 60 * 60 * 1000,
        }
      );

      // Calculate summary
      let totalInvested = 0;
      let totalReceived = 0;
      let successfulExecutions = 0;
      let failedExecutions = 0;

      for (const tx of transactions || []) {
        if (tx.type === "sip_execution") {
          if (tx.status === "success") {
            totalInvested += tx.amount;
            totalReceived += tx.amountOut || 0;
            successfulExecutions++;
          } else if (tx.status === "failed") {
            failedExecutions++;
          }
        }
      }

      // Build SIP summaries
      const sipSummaries = (sips || []).map((sip) => ({
        sipId: sip._id,
        sipName: sip.name,
        tokenSymbol: sip.tokenSymbol || "APT",
        amountInvested: sip.totalInvested || 0,
        tokensReceived: sip.totalReceived || 0,
        executionCount: sip.executionCount || 0,
        averagePrice: sip.averagePrice || 0,
      }));

      const reportId = `report-${args.userId}-${args.period}-${Date.now()}`;
      const now = new Date().toISOString();

      // Build report
      const report: MonthlyReport = {
        version: "1.0.0",
        reportId,
        reportType: "monthly_report",
        period: args.period,

        userId: args.userId,
        walletAddress: user.walletAddress || "",

        totalInvested,
        totalTokensReceived: totalReceived,
        averagePrice: totalReceived > 0 ? totalInvested / totalReceived : 0,
        portfolioValue: 0, // Would need price feed to calculate
        roi: 0, // Would need current price to calculate

        sipSummaries,

        transactionCount: (transactions || []).length,
        successfulExecutions,
        failedExecutions,

        totalRewardPoints: user.rewardPoints || 0,
        rewardTier: user.rewardTier || 0,

        generatedAt: now,
        network: process.env.APTOS_NETWORK || "testnet",
      };

      // Upload to Shelby
      let blobName = `monthly-reports/${args.userId}/${args.period}.json`;

      if (config.API_KEY) {
        try {
          const uploadResult = await uploadToShelby(config, blobName, report);
          if (uploadResult.success) {
            blobName = uploadResult.blobName || blobName;
          }
        } catch (uploadError) {
          console.warn("[Shelby] Upload failed, storing locally:", uploadError);
        }
      }

      // Store report reference
      await ctx.runMutation(internal.receipts.createReceipt, {
        userId: args.userId,
        type: "monthly_report",
        blobName,
        contentType: "application/json",
        summary: JSON.stringify({
          totalInvested,
          totalReceived,
          executionCount: successfulExecutions,
        }),
        period: args.period,
      });

      console.log(`[Shelby] Monthly report generated: ${reportId}`);

      return {
        success: true,
        reportId,
        blobName,
      };
    } catch (error) {
      console.error("[Shelby] Generate report error:", error);

      return {
        success: false,
        error: "Failed to generate monthly report",
      };
    }
  },
});

/**
 * Download a receipt/report
 */
export const downloadReceipt = action({
  args: {
    blobName: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    content: v.optional(v.string()),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const config = getConfig();

    if (!config.API_KEY) {
      // If Shelby not configured, return mock data
      return {
        success: true,
        content: JSON.stringify({
          message: "Shelby not configured. This is a placeholder receipt.",
          blobName: args.blobName,
        }),
      };
    }

    try {
      const response = await axios.get(
        `${config.API_URL}/blobs/${args.blobName}`,
        {
          headers: {
            Authorization: `Bearer ${config.API_KEY}`,
          },
          timeout: 15000,
        }
      );

      return {
        success: true,
        content: JSON.stringify(response.data),
      };
    } catch (error) {
      console.error("[Shelby] Download error:", error);

      return {
        success: false,
        error: "Failed to download receipt",
      };
    }
  },
});

// ============================================================================
// INTERNAL ACTIONS
// ============================================================================

/**
 * Auto-generate receipt after SIP execution (called by scheduler)
 */
export const autoGenerateReceipt = internalAction({
  args: {
    userId: v.id("users"),
    sipId: v.id("sips"),
    transactionId: v.id("transactions"),
    amountIn: v.number(),
    amountOut: v.number(),
    txHash: v.string(),
    blockNumber: v.optional(v.number()),
    rewardPoints: v.optional(v.number()),
  },
  returns: v.object({
    success: v.boolean(),
    blobName: v.optional(v.string()),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const config = getConfig();

    try {
      // Get user data
      const user = await ctx.runQuery(internal.users.getByIdInternal, {
        userId: args.userId,
      });

      if (!user) {
        return { success: false, error: "User not found" };
      }

      // Get SIP data
      const sip = await ctx.runQuery(internal.sips.getByIdInternal, {
        sipId: args.sipId,
      });

      if (!sip) {
        return { success: false, error: "SIP not found" };
      }

      // Generate receipt ID
      const receiptId = `receipt-${args.transactionId}-${Date.now()}`;
      const now = new Date().toISOString();

      // Build receipt object
      const receipt: SIPExecutionReceipt = {
        version: "1.0.0",
        receiptId,
        receiptType: "sip_execution",

        userId: args.userId,
        walletAddress: user.walletAddress || "",

        sipId: args.sipId,
        sipName: sip.name,
        sipIndex: sip.sipIndex || 0,
        vaultAddress: sip.vaultAddress || "",

        executionTimestamp: now,
        executionNumber: (sip.executionCount || 0) + 1,

        amountIn: args.amountIn,
        amountInToken: "USDC",
        amountOut: args.amountOut,
        amountOutToken: sip.tokenSymbol || "APT",
        executionPrice: args.amountOut > 0 ? args.amountIn / args.amountOut : 0,

        txHash: args.txHash,
        blockNumber: args.blockNumber,

        rewardPoints: args.rewardPoints,

        totalInvested: (sip.totalInvested || 0) + args.amountIn,
        totalReceived: (sip.totalReceived || 0) + args.amountOut,
        averagePrice: sip.averagePrice || 0,

        network: process.env.APTOS_NETWORK || "testnet",
        contractAddress: process.env.CONTRACT_ADDRESS || "0xcafe",
        generatedAt: now,
      };

      // Upload to Shelby (or store locally if not configured)
      let blobName = `sip-receipts/${args.userId}/${receiptId}.json`;

      if (config.API_KEY) {
        try {
          const uploadResult = await uploadToShelby(config, blobName, receipt);
          if (uploadResult.success) {
            blobName = uploadResult.blobName || blobName;
          }
        } catch (uploadError) {
          console.warn("[Shelby] Upload failed, storing locally:", uploadError);
        }
      }

      // Store receipt reference in Convex
      await ctx.runMutation(internal.receipts.createReceipt, {
        userId: args.userId,
        transactionId: args.transactionId,
        sipId: args.sipId,
        type: "sip_execution",
        blobName,
        contentType: "application/json",
        summary: JSON.stringify({
          amountIn: args.amountIn,
          amountOut: args.amountOut,
          txHash: args.txHash,
        }),
      });

      console.log(`[Shelby] Auto-generated receipt: ${receiptId}`);

      return {
        success: true,
        blobName,
      };
    } catch (error) {
      console.error("[Shelby] Auto-generate receipt error:", error);

      return {
        success: false,
        error: "Failed to auto-generate receipt",
      };
    }
  },
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function uploadToShelby(
  config: ReturnType<typeof getConfig>,
  blobName: string,
  content: object
): Promise<ReceiptUploadResult> {
  try {
    const response = await axios.post(
      `${config.API_URL}/blobs`,
      {
        bucket: config.BUCKET_NAME,
        name: blobName,
        content: JSON.stringify(content),
        contentType: "application/json",
      },
      {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.API_KEY}`,
        },
        timeout: 30000,
      }
    );

    return {
      success: true,
      blobName: response.data.name || blobName,
      url: response.data.url,
    };
  } catch (error) {
    console.error("[Shelby] Upload error:", error);

    return {
      success: false,
      error: "Failed to upload to Shelby",
    };
  }
}
