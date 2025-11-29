import {
    AccountAddress,
    createObjectAddress,
    MoveString
} from "@aptos-labs/ts-sdk";
import axios from "axios";
import { DECIBEL_CONFIG } from "../constants";

/**
 * Decibel DEX Integration Library
 *
 * Handles interaction with Decibel on-chain contracts and off-chain API.
 */

// ============================================================================
// ADDRESS DERIVATION
// ============================================================================

/**
 * Derive the global PerpEngine address
 * Seed: "GlobalPerpEngine"
 */
export function getPerpEngineGlobalAddress(): string {
  const packageAddr = AccountAddress.from(DECIBEL_CONFIG.PACKAGE_ADDRESS);
  const seed = new MoveString("GlobalPerpEngine").bcsToBytes();
  return createObjectAddress(packageAddr, seed).toString();
}

/**
 * Derive a Market address from the PerpEngine
 * Seed: Market Name (e.g., "USDC-APT-PERP")
 */
export function getMarketAddress(marketName: string): string {
  const perpEngineAddr = AccountAddress.from(getPerpEngineGlobalAddress());
  const seed = new MoveString(marketName).bcsToBytes();
  return createObjectAddress(perpEngineAddr, seed).toString();
}

/**
 * Derive the Primary Subaccount address for a user
 * Seed: "decibel_dex_primary"
 */
export function getPrimarySubaccountAddress(userAddr: string): string {
  const ownerAddr = AccountAddress.from(userAddr);
  const seed = new MoveString("decibel_dex_primary").bcsToBytes();
  return createObjectAddress(ownerAddr, seed).toString();
}

// ============================================================================
// TRANSACTION BUILDERS
// ============================================================================

export interface PlaceOrderArgs {
  marketName: string;
  price: number; // In 1e9 format (e.g. 5.67 => 5670000000)
  size: number; // In 1e9 format (e.g. 1.0 => 1000000000)
  isBuy: boolean;
  userAddr: string;
}

/**
 * Build payload for placing a single order to a subaccount
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
      args.price,
      args.size,
      args.isBuy,
      0, // timeInForce: GoodTillCanceled (0)
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
}

/**
 * Fetch market data from Decibel API
 */
export async function fetchMarketData(
  marketName: string
): Promise<MarketData | null> {
  try {
    const response = await axios.get(DECIBEL_CONFIG.API_URL);
    const markets = response.data.data; // Assuming standard response structure
    const market = markets.find((m: any) => m.market_name === marketName);
    return market || null;
  } catch (error) {
    console.error("Failed to fetch Decibel market data:", error);
    return null;
  }
}
