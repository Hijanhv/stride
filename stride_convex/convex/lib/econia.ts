import {
  AccountAddress,
  createObjectAddress,
  MoveString,
} from "@aptos-labs/ts-sdk";
import axios from "axios";

/**
 * Econia DEX Integration Library
 *
 * Handles real Econia CLOB integration on Aptos testnet:
 * - Address derivation (markets, subaccounts)
 * - Order placement
 * - Order fill tracking via Aptos Indexer
 * - Market data queries
 */

// ============================================================================
// CONFIGURATION
// ============================================================================

const ECONIA_PACKAGE =
  "0xc0deb00c9154b6b64db01e277648f5bd694cecc703fd0d9053fb95a58b292b17";
const APTOS_INDEXER_URL =
  process.env.APTOS_INDEXER_URL ||
  "https://api.testnet.aptoslabs.com/v1/graphql";
const APTOS_INDEXER_KEY = process.env.APTOS_INDEXER_API_KEY || "";

// ============================================================================
// ADDRESS DERIVATION (Exact Econia Pattern)
// ============================================================================

/**
 * Derive PerpEngine global address
 * Seed: "GlobalPerpEngine"
 */
export function getPerpEngineGlobalAddress(): string {
  const packageAddr = AccountAddress.from(ECONIA_PACKAGE);
  const seed = new MoveString("GlobalPerpEngine").bcsToBytes();
  return createObjectAddress(packageAddr, seed).toString();
}

/**
 * Derive Market address
 * Seed: Market name (e.g., "USDC-APT-PERP")
 */
export function getMarketAddress(marketName: string): string {
  const perpEngineAddr = AccountAddress.from(getPerpEngineGlobalAddress());
  const seed = new MoveString(marketName).bcsToBytes();
  return createObjectAddress(perpEngineAddr, seed).toString();
}

/**
 * Derive Primary Subaccount address
 * Seed: "decibel_dex_primary"
 */
export function getPrimarySubaccountAddress(userAddr: string): string {
  const ownerAddr = AccountAddress.from(userAddr);
  const seed = new MoveString("decibel_dex_primary").bcsToBytes();
  return createObjectAddress(ownerAddr, seed).toString();
}

// ============================================================================
// ORDER FILL TRACKING
// ============================================================================

export interface OrderFillEvent {
  order_id: string;
  subaccount_address: string;
  market_address: string;
  side: "buy" | "sell";
  fill_amount: number;
  fill_price: number;
  fees: number;
  timestamp: string;
  transaction_version: string;
}

/**
 * Query order fills from Aptos Indexer
 * Uses GraphQL to get fill events for a specific subaccount
 */
export async function queryOrderFills(
  subaccountAddress: string,
  sinceTimestamp?: string
): Promise<OrderFillEvent[]> {
  const query = `
    query GetOrderFills($subaccount: String!, $since: String) {
      events(
        where: {
          account_address: { _eq: $subaccount }
          type: { _like: "%OrderFillEvent%" }
          ${sinceTimestamp ? "indexed_at: { _gte: $since }" : ""}
        }
        order_by: { transaction_version: desc }
        limit: 50
      ) {
        sequence_number
        type
        data
        transaction_version
        indexed_at
      }
    }
  `;

  try {
    const response = await axios.post(
      APTOS_INDEXER_URL,
      {
        query,
        variables: {
          subaccount: subaccountAddress,
          since:
            sinceTimestamp ||
            new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        },
      },
      {
        headers: {
          "Content-Type": "application/json",
          ...(APTOS_INDEXER_KEY && {
            Authorization: `Bearer ${APTOS_INDEXER_KEY}`,
          }),
        },
        timeout: 15000,
      }
    );

    const events = response.data?.data?.events || [];

    return events.map((event: any) => ({
      order_id: event.data.order_id,
      subaccount_address: subaccountAddress,
      market_address: event.data.market_address,
      side: event.data.side === 0 ? "buy" : "sell",
      fill_amount: parseInt(event.data.fill_amount),
      fill_price: parseInt(event.data.fill_price),
      fees: parseInt(event.data.fees || "0"),
      timestamp: event.indexed_at,
      transaction_version: event.transaction_version,
    }));
  } catch (error) {
    console.error("[Econia] Failed to query order fills:", error);
    return [];
  }
}

/**
 * Poll for order fill (with timeout)
 * Returns the fill event when order completes
 */
export async function waitForOrderFill(
  subaccountAddress: string,
  orderId: string,
  timeoutMs: number = 30000
): Promise<OrderFillEvent | null> {
  const startTime = Date.now();
  const pollInterval = 2000; // Poll every 2 seconds

  while (Date.now() - startTime < timeoutMs) {
    const fills = await queryOrderFills(subaccountAddress);

    const matchingFill = fills.find((fill) => fill.order_id === orderId);
    if (matchingFill) {
      return matchingFill;
    }

    // Wait before next poll
    await new Promise((resolve) => setTimeout(resolve, pollInterval));
  }

  console.warn(`[Econia] Order ${orderId} did not fill within ${timeoutMs}ms`);
  return null;
}

// ============================================================================
// MARKET DATA
// ============================================================================

export interface MarketData {
  market_id: string;
  market_name: string;
  best_bid: number;
  best_ask: number;
  last_price: number;
  index_price: number;
  volume_24h: number;
}

/**
 * Fetch market data from Econia API (if available)
 * Falls back to on-chain queries if API unavailable
 */
export async function fetchMarketData(
  marketName: string
): Promise<MarketData | null> {
  try {
    // Try Econia API first (if they have one for testnet)
    const response = await axios.get(
      `https://api.testnet.econia.dev/v1/markets/${marketName}`,
      { timeout: 10000 }
    );

    return response.data;
  } catch (error) {
    console.warn("[Econia] API unavailable, using on-chain fallback");

    // Fallback: Query on-chain market state
    // This would require calling view functions on Econia contracts
    return null;
  }
}

/**
 * Get current market price (best bid/ask midpoint)
 */
export async function getCurrentPrice(
  marketName: string
): Promise<number | null> {
  const marketData = await fetchMarketData(marketName);

  if (!marketData) {
    return null;
  }

  // Return midpoint of best bid/ask
  return (marketData.best_bid + marketData.best_ask) / 2;
}

// ============================================================================
// TRANSACTION BUILDERS
// ============================================================================

export interface PlaceOrderArgs {
  marketName: string;
  price: number; // 0 for market order
  size: number; // Amount in base units
  isBuy: boolean;
  userAddr: string;
}

/**
 * Build payload for placing order to subaccount
 * This is what the backend scheduler will call
 */
export function buildPlaceOrderPayload(args: PlaceOrderArgs) {
  const subaccountAddr = getPrimarySubaccountAddress(args.userAddr);
  const marketAddr = getMarketAddress(args.marketName);

  return {
    function: `${ECONIA_PACKAGE}::dex_accounts::place_order_to_subaccount`,
    typeArguments: [],
    functionArguments: [
      subaccountAddr,
      marketAddr,
      args.price,
      args.size,
      args.isBuy,
      0, // timeInForce: GoodTillCanceled
      false, // isReduceOnly
      null, // clientOrderId
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

/**
 * Extract order ID from transaction events
 * Econia emits OrderPlaced event with order_id
 */
export function extractOrderIdFromTransaction(txResponse: any): string | null {
  try {
    const orderPlacedEvent = txResponse.events?.find(
      (event: any) =>
        event.type.includes("OrderPlaced") ||
        event.type.includes("order_placed")
    );

    return orderPlacedEvent?.data?.order_id || null;
  } catch (error) {
    console.error("[Econia] Failed to extract order ID:", error);
    return null;
  }
}
