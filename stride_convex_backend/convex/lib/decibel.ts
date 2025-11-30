import {
  AccountAddress,
  createObjectAddress,
  MoveString,
} from "@aptos-labs/ts-sdk";
import axios from "axios";
import { DECIBEL_CONFIG } from "../constants";

/**
 * Decibel DEX Integration Library
 *
 * Decibel is Aptos Labs' fully on-chain trading engine that unifies spot, perps,
 * margin, vaults, and composable DeFi ecosystem integrations.
 *
 * Key Features:
 * - Sub-20ms block times
 * - >1M orders per second capacity
 * - 100% on-chain order matching
 * - Multi-collateral cross-margin accounts
 *
 * Official Docs: https://docs.decibel.trade/
 * API Base: https://api.netna.aptoslabs.com/decibel
 */

// ============================================================================
// ADDRESS DERIVATION
// ============================================================================

/**
 * Derive the global PerpEngine address
 * This is the root object that manages all perpetual markets
 * Seed: "GlobalPerpEngine"
 */
export function getPerpEngineGlobalAddress(): string {
  const packageAddr = AccountAddress.from(DECIBEL_CONFIG.PACKAGE_ADDRESS);
  const seed = new MoveString("GlobalPerpEngine").bcsToBytes();
  return createObjectAddress(packageAddr, seed).toString();
}

/**
 * Derive a specific Market address from the PerpEngine
 * Each market (e.g., "BTC-PERP", "APT-PERP") has its own object address
 * Seed: Market Name (e.g., "BTC-PERP")
 */
export function getMarketAddress(marketName: string): string {
  const perpEngineAddr = AccountAddress.from(getPerpEngineGlobalAddress());
  const seed = new MoveString(marketName).bcsToBytes();
  return createObjectAddress(perpEngineAddr, seed).toString();
}

/**
 * Derive the Primary Subaccount address for a user
 * Each user has a primary trading subaccount that holds their positions
 * Seed: "decibel_dex_primary"
 */
export function getPrimarySubaccountAddress(userAddr: string): string {
  const ownerAddr = AccountAddress.from(userAddr);
  const seed = new MoveString("decibel_dex_primary").bcsToBytes();
  return createObjectAddress(ownerAddr, seed).toString();
}

// ============================================================================
// PRICE & SIZE FORMATTING
// ============================================================================

/**
 * Format a price for Decibel (9 decimals)
 * Example: formatPrice(5.67) => 5670000000
 *
 * @param price - Price as decimal number (e.g., 5.67)
 * @returns Price in Decibel format (integer with 9 decimals)
 */
export function formatPrice(price: number): number {
  return Math.floor(price * 10 ** DECIBEL_CONFIG.PRICE_DECIMALS);
}

/**
 * Format a size for Decibel (9 decimals)
 * Example: formatSize(1.5) => 1500000000
 *
 * @param size - Size as decimal number (e.g., 1.5)
 * @returns Size in Decibel format (integer with 9 decimals)
 */
export function formatSize(size: number): number {
  return Math.floor(size * 10 ** DECIBEL_CONFIG.SIZE_DECIMALS);
}

/**
 * Parse a Decibel price back to decimal
 * Example: parsePrice(5670000000) => 5.67
 */
export function parsePrice(priceRaw: number): number {
  return priceRaw / 10 ** DECIBEL_CONFIG.PRICE_DECIMALS;
}

/**
 * Parse a Decibel size back to decimal
 * Example: parseSize(1500000000) => 1.5
 */
export function parseSize(sizeRaw: number): number {
  return sizeRaw / 10 ** DECIBEL_CONFIG.SIZE_DECIMALS;
}

// ============================================================================
// TRANSACTION BUILDERS (For On-Chain Orders)
// ============================================================================

export interface PlaceOrderArgs {
  marketName: string; // e.g., "BTC-PERP"
  price: number; // 0 for market order, or limit price in decimals
  size: number; // Amount in base units (decimals)
  isBuy: boolean; // true = buy, false = sell
  userAddr: string; // User's wallet address
  timeInForce?: number; // 0 = GTC, 1 = PostOnly, 2 = IOC
  reduceOnly?: boolean; // Only reduce position, don't open new
  clientOrderId?: string; // Optional client-side order ID
}

/**
 * Build payload for placing an order to a subaccount
 * This creates the transaction data needed to submit an on-chain order
 *
 * Orders are executed via Move entry function:
 * `{package}::dex_accounts::place_order_to_subaccount`
 *
 * IMPORTANT: This places an order on the order book. Fill happens asynchronously!
 * Track fills via events or Geomi indexer.
 */
export function buildPlaceOrderPayload(args: PlaceOrderArgs) {
  const subaccountAddr = getPrimarySubaccountAddress(args.userAddr);
  const marketAddr = getMarketAddress(args.marketName);

  return {
    function: `${DECIBEL_CONFIG.PACKAGE_ADDRESS}::dex_accounts::place_order_to_subaccount`,
    typeArguments: [],
    functionArguments: [
      subaccountAddr,
      marketAddr,
      formatPrice(args.price), // Convert to 9 decimals
      formatSize(args.size), // Convert to 9 decimals
      args.isBuy,
      args.timeInForce ?? DECIBEL_CONFIG.TIME_IN_FORCE.GOOD_TILL_CANCELED,
      args.reduceOnly ?? false,
      args.clientOrderId ?? null,
      null, // stopPrice
      null, // tpTriggerPrice
      null, // tpLimitPrice
      null, // slTriggerPrice
      null, // slLimitPrice
      null, // builderAddr
      null, // builderFee
    ],
  };
}

// ============================================================================
// MARKET DATA (REST API)
// ============================================================================

export interface Market {
  symbol: string;
  name: string;
  lastPrice?: number;
  volume24h?: number;
  high24h?: number;
  low24h?: number;
  indexPrice?: number;
}

export interface OrderBookLevel {
  price: string;
  size: string;
}

export interface OrderBook {
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
}

export interface RecentTrade {
  price: string;
  size: string;
  side: "buy" | "sell";
  timestamp: string;
}

/**
 * Fetch all available markets from Decibel API
 * GET /api/v1/markets
 */
export async function getMarkets(): Promise<Market[]> {
  try {
    const response = await axios.get(
      `${DECIBEL_CONFIG.API_BASE_URL}/api/v1/markets`,
      { timeout: 10000 }
    );

    return response.data || [];
  } catch (error) {
    console.error("[Decibel] Failed to fetch markets:", error);
    return [];
  }
}

/**
 * Fetch detailed market data for a specific symbol
 * GET /api/v1/markets/{symbol}
 */
export async function getMarketDetails(marketSymbol: string): Promise<Market | null> {
  try {
    const response = await axios.get(
      `${DECIBEL_CONFIG.API_BASE_URL}/api/v1/markets/${marketSymbol}`,
      { timeout: 10000 }
    );

    return response.data;
  } catch (error) {
    console.error(`[Decibel] Failed to fetch market ${marketSymbol}:`, error);
    return null;
  }
}

/**
 * Fetch order book (depth) for a market
 * GET /api/v1/markets/{symbol}/orderbook
 *
 * @param marketSymbol - Market symbol (e.g., "BTC-PERP")
 * @param depth - Number of levels to fetch (default: 10)
 */
export async function getOrderBook(
  marketSymbol: string,
  depth: number = 10
): Promise<OrderBook | null> {
  try {
    const response = await axios.get(
      `${DECIBEL_CONFIG.API_BASE_URL}/api/v1/markets/${marketSymbol}/orderbook`,
      {
        params: { depth },
        timeout: 10000,
      }
    );

    return response.data;
  } catch (error) {
    console.error(`[Decibel] Failed to fetch order book for ${marketSymbol}:`, error);
    return null;
  }
}

/**
 * Get current market price (midpoint of best bid/ask)
 */
export async function getCurrentPrice(marketSymbol: string): Promise<number | null> {
  const orderBook = await getOrderBook(marketSymbol, 1);

  if (!orderBook || !orderBook.bids[0] || !orderBook.asks[0]) {
    return null;
  }

  const bestBid = parseFloat(orderBook.bids[0].price);
  const bestAsk = parseFloat(orderBook.asks[0].price);

  return (bestBid + bestAsk) / 2;
}

/**
 * Fetch recent trades for a market
 * GET /api/v1/markets/{symbol}/trades
 *
 * @param marketSymbol - Market symbol (e.g., "BTC-PERP")
 * @param limit - Number of trades to fetch (default: 10)
 */
export async function getRecentTrades(
  marketSymbol: string,
  limit: number = 10
): Promise<RecentTrade[]> {
  try {
    const response = await axios.get(
      `${DECIBEL_CONFIG.API_BASE_URL}/api/v1/markets/${marketSymbol}/trades`,
      {
        params: { limit },
        timeout: 10000,
      }
    );

    return response.data || [];
  } catch (error) {
    console.error(`[Decibel] Failed to fetch trades for ${marketSymbol}:`, error);
    return [];
  }
}

// ============================================================================
// ORDER FILL TRACKING
// ============================================================================

/**
 * Extract order ID from transaction events
 * Decibel emits OrderPlaced event with order_id when an order is submitted
 *
 * @param txResponse - Transaction response from Aptos SDK
 * @returns Order ID string or null if not found
 */
export function extractOrderIdFromTransaction(txResponse: any): string | null {
  try {
    const orderPlacedEvent = txResponse.events?.find(
      (event: any) =>
        event.type.includes("OrderPlaced") ||
        event.type.includes("order_placed") ||
        event.type.includes("OrderPlacedEvent")
    );

    return orderPlacedEvent?.data?.order_id || null;
  } catch (error) {
    console.error("[Decibel] Failed to extract order ID:", error);
    return null;
  }
}

/**
 * Helper: Check if an order is a market order (price = 0)
 */
export function isMarketOrder(price: number): boolean {
  return price === 0;
}

/**
 * Helper: Format order type for display
 */
export function getOrderTypeDisplay(price: number, isBuy: boolean): string {
  const side = isBuy ? "BUY" : "SELL";
  const type = isMarketOrder(price) ? "MARKET" : "LIMIT";
  return `${side} ${type}`;
}
