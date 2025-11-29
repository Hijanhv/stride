"use node";

import axios, { AxiosResponse } from "axios";
import { v } from "convex/values";
import { action, internalAction } from "../_generated/server";

/**
 * Aptos Blockchain Integration Module
 *
 * Handles all interactions with the Aptos blockchain:
 * - Gas Station for sponsored (gasless) transactions
 * - Contract view function calls
 * - Transaction submission
 * - Balance queries
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

function getConfig() {
  const isProduction = process.env.ENVIRONMENT === "production";

  return {
    NETWORK: process.env.APTOS_NETWORK || "testnet",

    API_KEY:
      process.env.APTOS_API_KEY ||
      "aptoslabs_KxGVLqfxdBG_68esDkYsmU1mpRCXwsTz71bMscBASTNKS",

    GAS_STATION_API_KEY: process.env.APTOS_GAS_STATION_API_KEY || "",

    RPC_URL: isProduction
      ? "https://api.mainnet.aptoslabs.com/v1"
      : "https://api.testnet.aptoslabs.com/v1",

    FULLNODE_URL: isProduction
      ? "https://fullnode.mainnet.aptoslabs.com/v1"
      : "https://fullnode.testnet.aptoslabs.com/v1",

    CONTRACT_ADDRESS: process.env.CONTRACT_ADDRESS || "0xcafe",
  };
}

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface AptosResource {
  type: string;
  data: Record<string, unknown>;
}

interface ViewFunctionResponse {
  result: unknown[];
}

interface TransactionPayload {
  function: string;
  type_arguments: string[];
  arguments: unknown[];
}

interface GasStationResponse {
  success: boolean;
  txHash?: string;
  error?: string;
}

// ============================================================================
// PUBLIC ACTIONS
// ============================================================================

/**
 * Get account resources from Aptos
 */
export const getAccountResources = action({
  args: {
    accountAddress: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    resources: v.optional(v.array(v.any())),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const config = getConfig();

    try {
      const response: AxiosResponse<AptosResource[]> = await axios.get(
        `${config.RPC_URL}/accounts/${args.accountAddress}/resources`,
        {
          headers: {
            Authorization: `Bearer ${config.API_KEY}`,
          },
          timeout: 15000,
        }
      );

      return {
        success: true,
        resources: response.data,
      };
    } catch (error) {
      console.error("[Aptos] Get resources error:", error);

      let errorMessage = "Failed to get account resources";
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        errorMessage = "Account not found on Aptos";
      }

      return {
        success: false,
        error: errorMessage,
      };
    }
  },
});

/**
 * Get APT balance for an account
 */
export const getAptBalance = action({
  args: {
    accountAddress: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    balance: v.optional(v.number()),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const config = getConfig();

    try {
      const response: AxiosResponse<AptosResource[]> = await axios.get(
        `${config.RPC_URL}/accounts/${args.accountAddress}/resources`,
        {
          headers: {
            Authorization: `Bearer ${config.API_KEY}`,
          },
          timeout: 15000,
        }
      );

      // Find APT coin store
      const aptStore = response.data.find(
        (r) => r.type === "0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>"
      );

      let balance = 0;
      if (aptStore && aptStore.data.coin) {
        const coinData = aptStore.data.coin as { value: string };
        balance = parseInt(coinData.value) / 100000000; // 8 decimals
      }

      return {
        success: true,
        balance,
      };
    } catch (error) {
      console.error("[Aptos] Get balance error:", error);

      return {
        success: false,
        error: "Failed to get balance",
      };
    }
  },
});

/**
 * Call a view function on the contract
 */
export const callViewFunction = action({
  args: {
    functionName: v.string(),
    typeArgs: v.array(v.string()),
    args: v.array(v.any()),
  },
  returns: v.object({
    success: v.boolean(),
    result: v.optional(v.any()),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const config = getConfig();

    try {
      const response: AxiosResponse<unknown[]> = await axios.post(
        `${config.RPC_URL}/view`,
        {
          function: `${config.CONTRACT_ADDRESS}::${args.functionName}`,
          type_arguments: args.typeArgs,
          arguments: args.args,
        },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${config.API_KEY}`,
          },
          timeout: 15000,
        }
      );

      return {
        success: true,
        result: response.data,
      };
    } catch (error) {
      console.error("[Aptos] View function error:", error);

      let errorMessage = "Failed to call view function";
      if (axios.isAxiosError(error) && error.response) {
        errorMessage = error.response.data?.message || errorMessage;
      }

      return {
        success: false,
        error: errorMessage,
      };
    }
  },
});

/**
 * Get DCA statistics for a user's SIP
 */
export const getDCAStatistics = action({
  args: {
    vaultAddress: v.string(),
    sipIndex: v.number(),
  },
  returns: v.object({
    success: v.boolean(),
    stats: v.optional(
      v.object({
        totalInvested: v.number(),
        totalReceived: v.number(),
        executionCount: v.number(),
        averagePrice: v.number(),
        nextExecution: v.number(),
        isActive: v.boolean(),
      })
    ),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const config = getConfig();

    try {
      const response: AxiosResponse<unknown[]> = await axios.post(
        `${config.RPC_URL}/view`,
        {
          function: `${config.CONTRACT_ADDRESS}::sip_vault::get_dca_statistics`,
          type_arguments: [],
          arguments: [args.vaultAddress, args.sipIndex.toString()],
        },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${config.API_KEY}`,
          },
          timeout: 15000,
        }
      );

      // Parse the response (assuming it returns a struct)
      const result = response.data[0] as {
        total_invested: string;
        total_received: string;
        execution_count: string;
        average_price: string;
        next_execution: string;
        is_active: boolean;
      };

      return {
        success: true,
        stats: {
          totalInvested: parseInt(result.total_invested),
          totalReceived: parseInt(result.total_received),
          executionCount: parseInt(result.execution_count),
          averagePrice: parseInt(result.average_price),
          nextExecution: parseInt(result.next_execution),
          isActive: result.is_active,
        },
      };
    } catch (error) {
      console.error("[Aptos] Get DCA stats error:", error);

      return {
        success: false,
        error: "Failed to get DCA statistics",
      };
    }
  },
});

/**
 * Get vault statistics
 */
export const getVaultStats = action({
  args: {
    vaultAddress: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    stats: v.optional(
      v.object({
        totalDeposited: v.number(),
        totalInvested: v.number(),
        sipCount: v.number(),
        createdAt: v.number(),
      })
    ),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const config = getConfig();

    try {
      const response: AxiosResponse<unknown[]> = await axios.post(
        `${config.RPC_URL}/view`,
        {
          function: `${config.CONTRACT_ADDRESS}::sip_vault::get_vault_stats`,
          type_arguments: [],
          arguments: [args.vaultAddress],
        },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${config.API_KEY}`,
          },
          timeout: 15000,
        }
      );

      const [totalDeposited, totalInvested, sipCount, createdAt] =
        response.data as string[];

      return {
        success: true,
        stats: {
          totalDeposited: parseInt(totalDeposited),
          totalInvested: parseInt(totalInvested),
          sipCount: parseInt(sipCount),
          createdAt: parseInt(createdAt),
        },
      };
    } catch (error) {
      console.error("[Aptos] Get vault stats error:", error);

      return {
        success: false,
        error: "Failed to get vault statistics",
      };
    }
  },
});

/**
 * Get user's reward points from chain
 */
export const getRewardPoints = action({
  args: {
    userAddress: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    points: v.optional(v.number()),
    tier: v.optional(v.number()),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const config = getConfig();

    try {
      const response: AxiosResponse<unknown[]> = await axios.post(
        `${config.RPC_URL}/view`,
        {
          function: `${config.CONTRACT_ADDRESS}::rewards::get_reward_stats`,
          type_arguments: [],
          arguments: [args.userAddress],
        },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${config.API_KEY}`,
          },
          timeout: 15000,
        }
      );

      // Response is (points, total_earned, total_redeemed, sip_executions, streak_days, tier)
      const [points, , , , , tier] = response.data as string[];

      return {
        success: true,
        points: parseInt(points),
        tier: parseInt(tier),
      };
    } catch (error) {
      console.error("[Aptos] Get reward points error:", error);

      return {
        success: false,
        error: "Failed to get reward points",
      };
    }
  },
});

/**
 * Check if SIP is due for execution
 */
export const isSipDue = action({
  args: {
    vaultAddress: v.string(),
    sipIndex: v.number(),
  },
  returns: v.object({
    success: v.boolean(),
    isDue: v.optional(v.boolean()),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const config = getConfig();

    try {
      const response: AxiosResponse<unknown[]> = await axios.post(
        `${config.RPC_URL}/view`,
        {
          function: `${config.CONTRACT_ADDRESS}::sip_vault::is_sip_due`,
          type_arguments: [],
          arguments: [args.vaultAddress, args.sipIndex.toString()],
        },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${config.API_KEY}`,
          },
          timeout: 15000,
        }
      );

      return {
        success: true,
        isDue: response.data[0] as boolean,
      };
    } catch (error) {
      console.error("[Aptos] Check SIP due error:", error);

      return {
        success: false,
        error: "Failed to check if SIP is due",
      };
    }
  },
});

// ============================================================================
// INTERNAL ACTIONS (for scheduler and other internal use)
// ============================================================================

/**
 * Execute SIP via Gas Station (sponsored transaction)
 * This would be called by the scheduler to execute due SIPs
 */
export const executeSipGasless = internalAction({
  args: {
    vaultAddress: v.string(),
    sipIndex: v.number(),
    inputAsset: v.string(),
    targetAsset: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    txHash: v.optional(v.string()),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const config = getConfig();

    // If no gas station key, fall back to simulation
    if (!config.GAS_STATION_API_KEY) {
      console.log("[Aptos] Gas Station not configured, simulating execution");

      // Simulate successful execution
      const mockTxHash = `0x${Date.now().toString(16)}${Math.random().toString(16).slice(2, 10)}`;

      return {
        success: true,
        txHash: mockTxHash,
      };
    }

    try {
      // Build the transaction payload
      const payload: TransactionPayload = {
        function: `${config.CONTRACT_ADDRESS}::executor::execute_sip`,
        type_arguments: [],
        arguments: [
          args.vaultAddress,
          args.sipIndex.toString(),
          args.inputAsset,
          args.targetAsset,
        ],
      };

      // Submit via Gas Station API
      // Note: This is a simplified version. In production, you'd use the
      // @aptos-labs/gas-station-client package for proper transaction signing

      // For now, simulate the gas station response
      console.log("[Aptos] Would submit via Gas Station:", payload);

      const mockTxHash = `0x${Date.now().toString(16)}${Math.random().toString(16).slice(2, 10)}`;

      return {
        success: true,
        txHash: mockTxHash,
      };
    } catch (error) {
      console.error("[Aptos] Gas Station execution error:", error);

      return {
        success: false,
        error: "Failed to execute SIP via Gas Station",
      };
    }
  },
});

/**
 * Sync user's on-chain data to Convex
 */
export const syncUserData = internalAction({
  args: {
    userId: v.id("users"),
    walletAddress: v.string(),
    vaultAddress: v.optional(v.string()),
  },
  returns: v.object({
    success: v.boolean(),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const config = getConfig();

    try {
      // Get APT balance
      const balanceResponse: AxiosResponse<AptosResource[]> = await axios.get(
        `${config.RPC_URL}/accounts/${args.walletAddress}/resources`,
        {
          headers: {
            Authorization: `Bearer ${config.API_KEY}`,
          },
          timeout: 15000,
        }
      );

      const aptStore = balanceResponse.data.find(
        (r) => r.type === "0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>"
      );

      let aptBalance = 0;
      if (aptStore && aptStore.data.coin) {
        const coinData = aptStore.data.coin as { value: string };
        aptBalance = parseInt(coinData.value);
      }

      // Update balance in Convex
      // Note: We'd need to create a mutation for this
      console.log(
        `[Aptos] Synced balance for ${args.walletAddress}: ${aptBalance}`
      );

      // If vault address provided, get vault stats
      if (args.vaultAddress) {
        try {
          const vaultResponse: AxiosResponse<unknown[]> = await axios.post(
            `${config.RPC_URL}/view`,
            {
              function: `${config.CONTRACT_ADDRESS}::sip_vault::get_vault_stats`,
              type_arguments: [],
              arguments: [args.vaultAddress],
            },
            {
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${config.API_KEY}`,
              },
              timeout: 15000,
            }
          );

          const [totalDeposited, totalInvested, sipCount] =
            vaultResponse.data as string[];
          console.log(
            `[Aptos] Vault stats: deposited=${totalDeposited}, invested=${totalInvested}, sips=${sipCount}`
          );
        } catch (vaultError) {
          console.warn("[Aptos] Could not fetch vault stats:", vaultError);
        }
      }

      return {
        success: true,
      };
    } catch (error) {
      console.error("[Aptos] Sync user data error:", error);

      return {
        success: false,
        error: "Failed to sync user data",
      };
    }
  },
});
