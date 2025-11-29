"use node";

import axios from "axios";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { action, internalAction } from "../_generated/server";

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
    INDEXER_GRAPHQL_URL:
      process.env.GEOMI_INDEXER_URL || "https://indexer.geomi.dev/v1/graphql",
    INDEXER_API_KEY: process.env.GEOMI_INDEXER_API_KEY || "",
    GAS_STATION_API_KEY: process.env.GEOMI_GAS_STATION_API_KEY || "",
    FULL_NODE_API_KEY: process.env.APTOS_API_KEY || "",
    NETWORK: process.env.APTOS_NETWORK || "testnet",
  };
}

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface VaultCreatedEvent {
  user_address: string;
  vault_address: string;
  timestamp: number;
  transaction_version: number;
}

interface SIPCreatedEvent {
  vault_address: string;
  sip_index: number;
  target_asset: string;
  amount: number;
  frequency: number;
  timestamp: number;
  transaction_version: number;
}

interface SIPExecutedEvent {
  vault_address: string;
  sip_index: number;
  amount_in: number;
  amount_out: number;
  timestamp: number;
  transaction_version: number;
  transaction_hash: string;
}

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
    const config = getConfig();

    if (!config.INDEXER_API_KEY) {
      console.warn("[Geomi] Indexer not configured, returning empty results");
      return { success: true, executions: [] };
    }

    try {
      const query = `
        query GetSIPExecutions($vaultAddress: String, $limit: Int) {
          sip_executed_events(
            where: { vault_address: { _eq: $vaultAddress } }
            order_by: { timestamp: desc }
            limit: $limit
          ) {
            vault_address
            sip_index
            amount_in
            amount_out
            timestamp
            transaction_hash
            transaction_version
          }
        }
      `;

      const response = await axios.post(
        config.INDEXER_GRAPHQL_URL,
        {
          query,
          variables: {
            vaultAddress: args.vaultAddress,
            limit: args.limit || 50,
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

      const events = response.data?.data?.sip_executed_events || [];

      const executions = events.map((event: SIPExecutedEvent) => ({
        vaultAddress: event.vault_address,
        sipIndex: event.sip_index,
        amountIn: event.amount_in,
        amountOut: event.amount_out,
        timestamp: event.timestamp,
        txHash: event.transaction_hash,
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
      // Query recent SIP executions
      const query = `
        query GetRecentExecutions {
          sip_executed_events(
            order_by: { timestamp: desc }
            limit: 100
          ) {
            vault_address
            sip_index
            amount_in
            amount_out
            timestamp
            transaction_hash
            transaction_version
          }
        }
      `;

      const response = await axios.post(
        config.INDEXER_GRAPHQL_URL,
        { query },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${config.INDEXER_API_KEY}`,
          },
          timeout: 15000,
        }
      );

      const events = response.data?.data?.sip_executed_events || [];

      let syncedCount = 0;

      // Process each event
      for (const event of events) {
        // Check if transaction already exists
        const exists = await ctx.runQuery(internal.transactions.txHashExists, {
          txHash: event.transaction_hash,
        });

        if (!exists) {
          // Find the SIP by vault address and index
          // This would require additional logic to map vault address to user/SIP
          // For now, we'll log it
          console.log(
            `[Geomi] New SIP execution detected: ${event.transaction_hash}`
          );
          syncedCount++;
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
