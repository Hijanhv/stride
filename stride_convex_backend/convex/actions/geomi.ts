"use node";

import axios from "axios";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { action, internalAction } from "../_generated/server";
import { APTOS_INDEXER_API_KEY, GEOMI_INDEXER_GRAPHQL_URL } from "../constants";
import {
  fetchRecentSIPExecutions,
  fetchSIPExecutionsByVault,
  fetchSwapExecutedEvents,
  fetchSwapPendingEvents,
  SIPExecutedEvent,
} from "../lib/geomi";

/**
 * Geomi Integration Module
 *
 * Handles interactions with Geomi services:
 * - No-Code Indexer for real-time blockchain event tracking
 * - Gas Station for gasless transaction execution
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

function getConfig() {
  return {
    INDEXER_GRAPHQL_URL: GEOMI_INDEXER_GRAPHQL_URL,
    INDEXER_API_KEY: APTOS_INDEXER_API_KEY,
    GAS_STATION_API_KEY: process.env.GEOMI_GAS_STATION_API_KEY || "",
    FULL_NODE_API_KEY: process.env.APTOS_API_KEY || "",
    NETWORK: process.env.APTOS_NETWORK || "testnet",
  };
}

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

// Re-using types from geomiClient where possible
// Keeping local interfaces if they differ or for other events not yet in client

interface DepositEvent {
  vault_address: string;
  asset: string;
  amount: number;
  timestamp: number;
  transaction_version: number;
}

// ============================================================================
// INDEXER QUERIES
// ============================================================================

/**
 * Query recent SIP executions from Geomi indexer
 */
export const queryRecentSIPExecutions = action({
  args: {
    vaultAddress: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  returns: v.object({
    success: v.boolean(),
    executions: v.optional(
      v.array(
        v.object({
          vaultAddress: v.string(),
          sipIndex: v.number(),
          amountIn: v.number(),
          amountOut: v.number(),
          timestamp: v.number(),
          txHash: v.string(),
        })
      )
    ),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    try {
      let events: SIPExecutedEvent[] = [];
      const limit = args.limit || 50;

      if (args.vaultAddress) {
        events = await fetchSIPExecutionsByVault(args.vaultAddress, limit);
      } else {
        events = await fetchRecentSIPExecutions(limit);
      }

      const executions = events.map((event) => ({
        vaultAddress: event.vault_addr, // Note: geomi lib uses snake_case
        sipIndex: event.sip_id,
        amountIn: parseFloat(event.amount_in),
        amountOut: parseFloat(event.amount_out),
        timestamp: parseInt(event.timestamp),
        txHash: event.transaction_version,
      }));

      return {
        success: true,
        executions,
      };
    } catch (error) {
      console.error("[Geomi] Query SIP executions error:", error);

      return {
        success: false,
        error: "Failed to query SIP executions",
      };
    }
  },
});


/**
 * Query vault events for a user
 */
export const queryUserVaultEvents = action({
  args: {
    userAddress: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    vaultAddress: v.optional(v.string()),
    deposits: v.optional(
      v.array(
        v.object({
          asset: v.string(),
          amount: v.number(),
          timestamp: v.number(),
        })
      )
    ),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const config = getConfig();

    if (!config.INDEXER_API_KEY) {
      console.warn("[Geomi] Indexer not configured");
      return { success: false, error: "Indexer not configured" };
    }

    try {
      const query = `
        query GetUserVault($userAddress: String!) {
          vault_created_events(
            where: { user_address: { _eq: $userAddress } }
            limit: 1
          ) {
            vault_address
            timestamp
          }
          deposit_events(
            where: { 
              vault_address: { 
                _in: (
                  select vault_address 
                  from vault_created_events 
                  where user_address = $userAddress
                )
              }
            }
            order_by: { timestamp: desc }
          ) {
            asset
            amount
            timestamp
          }
        }
      `;

      const response = await axios.post(
        config.INDEXER_GRAPHQL_URL,
        {
          query,
          variables: {
            userAddress: args.userAddress,
          },
        },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${config.INDEXER_API_KEY}`,
          },
          timeout: 15000,
        }
      );

      const vaultEvents = response.data?.data?.vault_created_events || [];
      const depositEvents = response.data?.data?.deposit_events || [];

      const vaultAddress = vaultEvents[0]?.vault_address;

      const deposits = depositEvents.map((event: DepositEvent) => ({
        asset: event.asset,
        amount: event.amount,
        timestamp: event.timestamp,
      }));

      return {
        success: true,
        vaultAddress,
        deposits,
      };
    } catch (error) {
      console.error("[Geomi] Query vault events error:", error);

      return {
        success: false,
        error: "Failed to query vault events",
      };
    }
  },
});

/**
 * Sync blockchain events to Convex database
 */
export const syncBlockchainEvents = internalAction({
  args: {},
  returns: v.object({
    success: v.boolean(),
    syncedCount: v.number(),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const config = getConfig();

    if (!config.INDEXER_API_KEY) {
      console.log("[Geomi] Indexer not configured, skipping sync");
      return { success: true, syncedCount: 0 };
    }

    try {
      // Query recent events
      const [sipEvents, swapPendingEvents, swapExecutedEvents] = await Promise.all([
        fetchRecentSIPExecutions(100),
        fetchSwapPendingEvents("0", 100), // Using "0" as version to get all recent
        fetchSwapExecutedEvents("0", 100),
      ]);

      let syncedCount = 0;

      // Process SIP Executed events
      for (const event of sipEvents) {
        const txHash = event.transaction_hash || event.transaction_version;
        const exists = await ctx.runQuery(internal.transactions.txHashExists, {
          txHash,
        });

        if (!exists) {
          console.log(`[Geomi] New SIP execution detected: ${txHash}`);
          syncedCount++;
          // TODO: Store event in DB
        }
      }

      // Process Swap Pending events
      for (const event of swapPendingEvents) {
        const txHash = event.transaction_version; // Swap events might not have hash in interface
        const exists = await ctx.runQuery(internal.transactions.txHashExists, {
          txHash,
        });

        if (!exists) {
          console.log(`[Geomi] New Swap Pending detected: ${txHash}`);
          syncedCount++;
          // TODO: Trigger swap execution
        }
      }

      // Process Swap Executed events
      for (const event of swapExecutedEvents) {
        const txHash = event.transaction_version;
        const exists = await ctx.runQuery(internal.transactions.txHashExists, {
          txHash,
        });

        if (!exists) {
          console.log(`[Geomi] New Swap Executed detected: ${txHash}`);
          syncedCount++;
          // TODO: Update SIP stats
        }
      }

      console.log(`[Geomi] Synced ${syncedCount} new events`);

      return {
        success: true,
        syncedCount,
      };
    } catch (error) {
      console.error("[Geomi] Sync blockchain events error:", error);

      return {
        success: false,
        syncedCount: 0,
        error: "Failed to sync blockchain events",
      };
    }
  },
});

// ============================================================================
// GAS STATION INTEGRATION
// ============================================================================

/**
 * Execute a transaction using Gas Station (gasless)
 */
export const executeGaslessTransaction = internalAction({
  args: {
    senderAddress: v.string(),
    payload: v.object({
      function: v.string(),
      type_arguments: v.array(v.string()),
      arguments: v.array(v.any()),
    }),
  },
  returns: v.object({
    success: v.boolean(),
    txHash: v.optional(v.string()),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const config = getConfig();

    if (!config.GAS_STATION_API_KEY) {
      return {
        success: false,
        error: "Gas Station not configured",
      };
    }

    try {
      // Note: This is a placeholder implementation
      // The actual Gas Station integration would use the Aptos SDK
      // with the GasStationTransactionSubmitter plugin

      console.log("[Geomi] Gas Station execution:", {
        sender: args.senderAddress,
        function: args.payload.function,
      });

      // TODO: Implement actual Gas Station transaction submission
      // using @aptos-labs/gas-station-client

      return {
        success: false,
        error: "Gas Station integration pending - use Aptos SDK in scheduler",
      };
    } catch (error) {
      console.error("[Geomi] Gas Station execution error:", error);

      return {
        success: false,
        error: "Failed to execute gasless transaction",
      };
    }
  },
});
