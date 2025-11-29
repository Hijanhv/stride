"use node";

import axios, { AxiosResponse } from "axios";
import { v } from "convex/values";
import jwt from "jsonwebtoken";
import { internal } from "../_generated/api";
import { Id } from "../_generated/dataModel";
import { action, internalAction } from "../_generated/server";

/**
 * Photon API Integration Module
 *
 * Handles all interactions with the Photon API for:
 * - User registration and embedded wallet creation
 * - Campaign event triggering for rewards
 * - Token refresh
 *
 * Network: Aptos Testnet (stage environment)
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface PhotonConfig {
  PHOTON_BASE_URL: string;
  API_KEY: string;
  JWT_SECRET: string;
  CAMPAIGN_ID: string;
  APTOS_RPC_URL: string;
  APTOS_NETWORK: string;
}

interface PhotonRegisterResponse {
  data: {
    user: { user: { id: string } };
    wallet: { walletAddress: string };
    tokens: {
      access_token: string;
      refresh_token: string;
      expires_in: number;
    };
  };
}

interface PhotonEventResponse {
  data: {
    success: boolean;
    event_id: string;
    token_amount: number;
    token_symbol: string;
    campaign_id: string;
  };
}

interface PhotonRefreshResponse {
  data: {
    tokens: {
      access_token: string;
      refresh_token: string;
      expires_in: number;
    };
  };
}

interface AptosResource {
  type: string;
  data: {
    coin?: { value: string };
    balance?: string;
  };
}

type UserInternal = {
  _id: Id<"users">;
  phone: string;
  name?: string;
  walletAddress?: string;
  photonId?: string;
  accessToken?: string;
  refreshToken?: string;
  tokenExpiresAt?: number;
} | null;

// ============================================================================
// ENVIRONMENT CONFIGURATION
// ============================================================================

function getConfig(): PhotonConfig {
  const isProduction = process.env.ENVIRONMENT === "production";

  return {
    PHOTON_BASE_URL:
      process.env.PHOTON_BASE_URL ||
      (isProduction
        ? "https://api.getstan.app/identity-service/api/v1"
        : "https://stage-api.getstan.app/identity-service/api/v1"),

    API_KEY: process.env.PHOTON_API_KEY || "",

    JWT_SECRET: process.env.PHOTON_JWT_SECRET || "",

    CAMPAIGN_ID: process.env.PHOTON_CAMPAIGN_ID || "",

    APTOS_RPC_URL:
      process.env.APTOS_RPC_URL ||
      (isProduction
        ? "https://fullnode.mainnet.aptoslabs.com/v1"
        : "https://fullnode.testnet.aptoslabs.com/v1"),

    APTOS_NETWORK:
      process.env.APTOS_NETWORK || (isProduction ? "mainnet" : "testnet"),
  };
}

// ============================================================================
// JWT UTILITIES
// ============================================================================

function generatePhotonJWT(email: string, phone: string): string {
  const config = getConfig();
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + 3600;

  return jwt.sign(
    {
      iss: "Stride",
      iat: iat,
      exp: exp,
      aud: "www.stride.com",
      sub: email,
      Email: email,
      GivenName: "User",
      Surname: phone,
      email: email,
      name: `User ${phone}`,
    },
    config.JWT_SECRET
  );
}

// ============================================================================
// PUBLIC ACTIONS
// ============================================================================

export const registerUser = action({
  args: {
    phone: v.string(),
    name: v.optional(v.string()),
  },
  returns: v.object({
    success: v.boolean(),
    userId: v.optional(v.id("users")),
    walletAddress: v.optional(v.string()),
    photonId: v.optional(v.string()),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const config = getConfig();

    try {
      const userEmail = `${args.phone}@stride.app`;
      const token = generatePhotonJWT(userEmail, args.phone);

      console.log(`[Photon] Registering user: ${args.phone}`);

      const response: AxiosResponse<PhotonRegisterResponse> = await axios.post(
        `${config.PHOTON_BASE_URL}/identity/register`,
        {
          provider: "jwt",
          data: { token },
        },
        {
          headers: {
            "Content-Type": "application/json",
            "X-API-Key": config.API_KEY,
          },
          timeout: 30000,
        }
      );

      const photonData = response.data.data;
      const walletAddress = photonData.wallet.walletAddress;
      const photonId = photonData.user.user.id;
      const accessToken = photonData.tokens.access_token;
      const refreshToken = photonData.tokens.refresh_token;
      const expiresIn = photonData.tokens.expires_in || 3600;
      const tokenExpiresAt = Date.now() + expiresIn * 1000;

      console.log(
        `[Photon] User registered. Wallet: ${walletAddress}, PhotonId: ${photonId}`
      );

      const userId: Id<"users"> = await ctx.runMutation(
        internal.users.createWithPhoton,
        {
          phone: args.phone,
          walletAddress,
          photonId,
          accessToken,
          refreshToken,
          tokenExpiresAt,
        }
      );

      return {
        success: true,
        userId,
        walletAddress,
        photonId,
      };
    } catch (error) {
      console.error("[Photon] Registration error:", error);

      let errorMessage = "Failed to register with Photon";
      if (axios.isAxiosError(error) && error.response) {
        console.error("[Photon] Response data:", error.response.data);
        errorMessage = error.response.data?.message || errorMessage;
      }

      return {
        success: false,
        error: errorMessage,
      };
    }
  },
});

export const triggerRewardEvent = action({
  args: {
    userId: v.id("users"),
    eventType: v.string(),
    metadata: v.optional(
      v.object({
        amount: v.optional(v.number()),
        sipId: v.optional(v.string()),
      })
    ),
  },
  returns: v.object({
    success: v.boolean(),
    tokenAmount: v.optional(v.number()),
    tokenSymbol: v.optional(v.string()),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const config = getConfig();

    try {
      const user: UserInternal = await ctx.runQuery(
        internal.users.getByIdInternal,
        {
          userId: args.userId,
        }
      );

      if (!user) {
        return { success: false, error: "User not found" };
      }

      if (!user.photonId || !user.accessToken) {
        return { success: false, error: "User not registered with Photon" };
      }

      if (user.tokenExpiresAt && user.tokenExpiresAt < Date.now()) {
        console.log("[Photon] Access token expired, should refresh");
      }

      const eventId = `${args.eventType}-${args.userId}-${Date.now()}`;

      console.log(
        `[Photon] Triggering event: ${args.eventType} for user ${args.userId}`
      );

      const response: AxiosResponse<PhotonEventResponse> = await axios.post(
        `${config.PHOTON_BASE_URL}/attribution/events/campaign`,
        {
          event_id: eventId,
          event_type: args.eventType,
          user_id: user.photonId,
          campaign_id: config.CAMPAIGN_ID,
          metadata: args.metadata || {},
          timestamp: new Date().toISOString(),
        },
        {
          headers: {
            "Content-Type": "application/json",
            "X-API-Key": config.API_KEY,
            Authorization: `Bearer ${user.accessToken}`,
          },
          timeout: 30000,
        }
      );

      const eventData = response.data.data;

      console.log(
        `[Photon] Event processed. Tokens: ${eventData.token_amount} ${eventData.token_symbol}`
      );

      if (eventData.token_amount > 0) {
        const rewardId: Id<"rewards"> = await ctx.runMutation(
          internal.rewards.recordReward,
          {
            userId: args.userId,
            eventId,
            eventType: args.eventType,
            campaignId: config.CAMPAIGN_ID,
            tokenAmount: eventData.token_amount,
            tokenSymbol: eventData.token_symbol || "PHOTON",
          }
        );
        console.log(`[Photon] Reward recorded: ${rewardId}`);
      }

      return {
        success: true,
        tokenAmount: eventData.token_amount,
        tokenSymbol: eventData.token_symbol,
      };
    } catch (error) {
      console.error("[Photon] Event trigger error:", error);

      let errorMessage = "Failed to trigger reward event";
      if (axios.isAxiosError(error) && error.response) {
        console.error("[Photon] Response data:", error.response.data);
        errorMessage = error.response.data?.message || errorMessage;
      }

      return {
        success: false,
        error: errorMessage,
      };
    }
  },
});

export const getWalletBalance = action({
  args: { walletAddress: v.string() },
  returns: v.object({
    success: v.boolean(),
    aptBalance: v.optional(v.number()),
    photonBalance: v.optional(v.number()),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const config = getConfig();

    try {
      const response: AxiosResponse<Array<AptosResource>> = await axios.get(
        `${config.APTOS_RPC_URL}/accounts/${args.walletAddress}/resources`,
        { timeout: 15000 }
      );

      const resources: Array<AptosResource> = response.data;

      let aptBalance = 0;
      const aptResource = resources.find(
        (r) => r.type === "0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>"
      );
      if (aptResource && aptResource.data.coin) {
        aptBalance = parseInt(aptResource.data.coin.value) / 100000000;
      }

      let photonBalance = 0;
      const photonResource = resources.find((r) =>
        r.type.includes("PhotonCampaignManagerModule::UserStore")
      );
      if (photonResource && photonResource.data.balance) {
        photonBalance = parseFloat(photonResource.data.balance);
      }

      return {
        success: true,
        aptBalance,
        photonBalance,
      };
    } catch (error) {
      console.error("[Aptos] Get balance error:", error);

      let errorMessage = "Failed to get wallet balance";
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        errorMessage = "Wallet not found on Aptos";
      }

      return {
        success: false,
        error: errorMessage,
      };
    }
  },
});

// ============================================================================
// INTERNAL ACTIONS
// ============================================================================

export const triggerSIPReward = internalAction({
  args: {
    userId: v.id("users"),
    sipId: v.id("sips"),
    amount: v.number(),
  },
  returns: v.object({
    success: v.boolean(),
    tokenAmount: v.optional(v.number()),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const config = getConfig();

    try {
      const user: UserInternal = await ctx.runQuery(
        internal.users.getByIdInternal,
        {
          userId: args.userId,
        }
      );

      if (!user || !user.photonId || !user.accessToken) {
        return {
          success: false,
          error: "User not found or not registered with Photon",
        };
      }

      const eventId = `sip_execution-${args.sipId}-${Date.now()}`;

      console.log(
        `[Photon] Triggering SIP reward for user ${args.userId}, amount: ${args.amount}`
      );

      const response: AxiosResponse<PhotonEventResponse> = await axios.post(
        `${config.PHOTON_BASE_URL}/attribution/events/campaign`,
        {
          event_id: eventId,
          event_type: "sip_execution",
          user_id: user.photonId,
          campaign_id: config.CAMPAIGN_ID,
          metadata: {
            sip_id: args.sipId,
            amount: args.amount,
          },
          timestamp: new Date().toISOString(),
        },
        {
          headers: {
            "Content-Type": "application/json",
            "X-API-Key": config.API_KEY,
            Authorization: `Bearer ${user.accessToken}`,
          },
          timeout: 30000,
        }
      );

      const eventData = response.data.data;

      console.log(
        `[Photon] SIP reward processed. Tokens: ${eventData.token_amount}`
      );

      if (eventData.token_amount > 0) {
        const rewardId: Id<"rewards"> = await ctx.runMutation(
          internal.rewards.recordReward,
          {
            userId: args.userId,
            eventId,
            eventType: "sip_execution",
            campaignId: config.CAMPAIGN_ID,
            tokenAmount: eventData.token_amount,
            tokenSymbol: eventData.token_symbol || "PHOTON",
          }
        );
        console.log(`[Photon] SIP reward recorded: ${rewardId}`);
      }

      return {
        success: true,
        tokenAmount: eventData.token_amount,
      };
    } catch (error) {
      console.error("[Photon] SIP reward error:", error);

      let errorMessage = "Failed to trigger SIP reward";
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

export const refreshAccessToken = internalAction({
  args: { userId: v.id("users") },
  returns: v.object({
    success: v.boolean(),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    const config = getConfig();

    try {
      const user: UserInternal = await ctx.runQuery(
        internal.users.getByIdInternal,
        {
          userId: args.userId,
        }
      );

      if (!user || !user.refreshToken) {
        return { success: false, error: "User not found or no refresh token" };
      }

      const response: AxiosResponse<PhotonRefreshResponse> = await axios.post(
        `${config.PHOTON_BASE_URL}/identity/token/refresh`,
        {
          refresh_token: user.refreshToken,
        },
        {
          headers: {
            "Content-Type": "application/json",
            "X-API-Key": config.API_KEY,
          },
          timeout: 15000,
        }
      );

      const tokenData = response.data.data.tokens;
      const expiresIn = tokenData.expires_in || 3600;
      const tokenExpiresAt = Date.now() + expiresIn * 1000;

      await ctx.runMutation(internal.users.updateAccessToken, {
        userId: args.userId,
        accessToken: tokenData.access_token,
        tokenExpiresAt,
        refreshToken: tokenData.refresh_token,
      });

      console.log(`[Photon] Token refreshed for user ${args.userId}`);

      return { success: true };
    } catch (error) {
      console.error("[Photon] Token refresh error:", error);

      return {
        success: false,
        error: "Failed to refresh token",
      };
    }
  },
});
