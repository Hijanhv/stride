"use node";

import { action } from "../_generated/server";
import * as decibel from "../lib/decibel";

/**
 * Decibel Actions
 *
 * High-level actions for interacting with Decibel DEX.
 *
 * CURRENT STATUS:
 * - Integrates with Decibel CLOB on both Testnet and Mainnet
 * - Provides market data and order building utilities
 */

// ============================================================================
// MARKET DATA
// ============================================================================

/**
 * Get all available markets from Decibel
 */
export const getMarkets = action(async () => {
  return await decibel.getMarkets();
});

/**
 * Get detailed market data for a specific symbol
 */
export const getMarketDetails = action(
  async (_, args: { marketSymbol: string }) => {
    return await decibel.getMarketDetails(args.marketSymbol);
  }
);

/**
 * Get order book (depth) for a market
 */
export const getOrderBook = action(
  async (_, args: { marketSymbol: string; depth?: number }) => {
    return await decibel.getOrderBook(args.marketSymbol, args.depth ?? 10);
  }
);

/**
 * Get current market price (midpoint of best bid/ask)
 */
export const getCurrentPrice = action(
  async (_, args: { marketSymbol: string }) => {
    return await decibel.getCurrentPrice(args.marketSymbol);
  }
);

/**
 * Get recent trades for a market
 */
export const getRecentTrades = action(
  async (_, args: { marketSymbol: string; limit?: number }) => {
    return await decibel.getRecentTrades(args.marketSymbol, args.limit ?? 10);
  }
);

// ============================================================================
// ADDRESS DERIVATION
// ============================================================================

/**
 * Get the Decibel PerpEngine global address
 */
export const getPerpEngineAddress = action(async () => {
  return decibel.getPerpEngineGlobalAddress();
});

/**
 * Get market address for a specific market name
 */
export const getMarketAddress = action(
  async (_, args: { marketName: string }) => {
    return decibel.getMarketAddress(args.marketName);
  }
);

/**
 * Get primary subaccount address for a user
 */
export const getSubaccountAddress = action(
  async (_, args: { userAddress: string }) => {
    return decibel.getPrimarySubaccountAddress(args.userAddress);
  }
);

// ============================================================================
// PRICE & SIZE FORMATTING
// ============================================================================

/**
 * Format a price for Decibel (9 decimals)
 */
export const formatPrice = action(async (_, args: { price: number }) => {
  return decibel.formatPrice(args.price);
});

/**
 * Format a size for Decibel (9 decimals)
 */
export const formatSize = action(async (_, args: { size: number }) => {
  return decibel.formatSize(args.size);
});

/**
 * Parse a Decibel price back to decimal
 */
export const parsePrice = action(async (_, args: { priceRaw: number }) => {
  return decibel.parsePrice(args.priceRaw);
});

/**
 * Parse a Decibel size back to decimal
 */
export const parseSize = action(async (_, args: { sizeRaw: number }) => {
  return decibel.parseSize(args.sizeRaw);
});

// ============================================================================
// ORDER MANAGEMENT
// ============================================================================

/**
 * Build transaction payload for placing an order
 * Returns the payload that can be used with Aptos SDK to submit transaction
 */
export const buildPlaceOrderPayload = action(
  async (
    _,
    args: {
      marketName: string;
      price: number;
      size: number;
      isBuy: boolean;
      userAddr: string;
      timeInForce?: number;
      reduceOnly?: boolean;
      clientOrderId?: string;
    }
  ) => {
    return decibel.buildPlaceOrderPayload(args);
  }
);

/**
 * Extract order ID from transaction response
 */
export const extractOrderId = action(async (_, args: { txResponse: any }) => {
  return decibel.extractOrderIdFromTransaction(args.txResponse);
});

/**
 * Check if an order is a market order (price = 0)
 */
export const isMarketOrder = action(async (_, args: { price: number }) => {
  return decibel.isMarketOrder(args.price);
});

/**
 * Get order type display string (e.g., "BUY MARKET", "SELL LIMIT")
 */
export const getOrderTypeDisplay = action(
  async (_, args: { price: number; isBuy: boolean }) => {
    return decibel.getOrderTypeDisplay(args.price, args.isBuy);
  }
);

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get recommended market for a target asset
 * Maps asset symbols to Decibel market names
 */
export const getMarketForAsset = action(
  async (_, args: { assetSymbol: string }) => {
    const assetMap: Record<string, string> = {
      BTC: "BTC-PERP",
      APT: "APT-PERP",
      ETH: "ETH-PERP",
      SOL: "SOL-PERP",
    };

    return assetMap[args.assetSymbol.toUpperCase()] || "APT-PERP"; // Default to APT-PERP
  }
);

/**
 * Calculate estimated output for a market buy order
 * Based on current order book depth
 */
export const estimateMarketBuyOutput = action(
  async (_, args: { marketSymbol: string; inputAmount: number }) => {
    const orderBook = await decibel.getOrderBook(args.marketSymbol, 20);

    if (!orderBook || !orderBook.asks || orderBook.asks.length === 0) {
      return null;
    }

    let remainingAmount = args.inputAmount;
    let totalOutput = 0;

    for (const ask of orderBook.asks) {
      const price = parseFloat(ask.price);
      const size = parseFloat(ask.size);

      if (remainingAmount <= 0) break;

      const canBuy = Math.min(remainingAmount / price, size);
      totalOutput += canBuy;
      remainingAmount -= canBuy * price;
    }

    return {
      estimatedOutput: totalOutput,
      remainingInput: remainingAmount,
      fullyFilled: remainingAmount === 0,
      averagePrice: args.inputAmount / totalOutput,
    };
  }
);

/**
 * Calculate slippage for a market order
 * Compares estimated execution price to current mid-market price
 */
export const calculateSlippage = action(
  async (
    _,
    args: { marketSymbol: string; inputAmount: number; isBuy: boolean }
  ) => {
    const [estimate, midPrice] = await Promise.all([
      args.isBuy
        ? decibel.getOrderBook(args.marketSymbol, 20).then((ob) => {
            if (!ob || !ob.asks || ob.asks.length === 0) return null;
            let remaining = args.inputAmount;
            let total = 0;
            for (const ask of ob.asks) {
              const p = parseFloat(ask.price);
              const s = parseFloat(ask.size);
              if (remaining <= 0) break;
              const canBuy = Math.min(remaining / p, s);
              total += canBuy;
              remaining -= canBuy * p;
            }
            return {
              estimatedOutput: total,
              remainingInput: remaining,
              fullyFilled: remaining === 0,
              averagePrice: args.inputAmount / total,
            };
          })
        : null,
      decibel.getCurrentPrice(args.marketSymbol),
    ]);

    if (!estimate || !midPrice) {
      return null;
    }

    const slippage = ((estimate.averagePrice - midPrice) / midPrice) * 100;

    return {
      midPrice,
      estimatedPrice: estimate.averagePrice,
      slippagePercent: slippage,
      estimatedOutput: estimate.estimatedOutput,
      fullyFilled: estimate.fullyFilled,
    };
  }
);

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Check if Decibel is available on current network
 */
export const isDecibelAvailable = action(async () => {
  // Check if Decibel API is reachable
  try {
    const markets = await decibel.getMarkets();
    return {
      available: markets.length > 0,
      network: process.env.APTOS_NETWORK || "testnet",
      message:
        markets.length > 0
          ? "Decibel is available and operational."
          : "Decibel API returned no markets.",
    };
  } catch (error) {
    return {
      available: false,
      network: process.env.APTOS_NETWORK || "testnet",
      message: "Failed to connect to Decibel API.",
    };
  }
});
