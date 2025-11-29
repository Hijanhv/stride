"use node";

import { AptosPriceServiceConnection } from "@pythnetwork/pyth-aptos-js";

/**
 * Pyth Network Oracle Integration
 * 
 * Fetches real-time crypto price feeds from Pyth Network's Hermes service.
 * Used for accurate treasury conversions (e.g., USDC -> APT).
 * 
 * Documentation: https://docs.pyth.network/price-feeds/use-real-time-data/aptos
 */

// Hermes URL (Public endpoint)
const HERMES_URL = "https://hermes.pyth.network";

// Price Feed IDs (Mainnet & Testnet are often the same for major pairs, but verifying is good practice)
// Using Mainnet IDs as they are most reliable and often mirrored.
// Source: https://pyth.network/developers/price-feed-ids
const PRICE_FEEDS = {
  USDC: "eaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a", // USDC/USD
  APT: "03ae4db29ed4ae33d323568895aa00337e658e348b37509f5372ae51f0af00d5",  // APT/USD
};

/**
 * Fetch the real-time conversion rate between two assets using Pyth.
 * 
 * @param fromSymbol - The symbol of the input asset (e.g., "USDC")
 * @param toSymbol - The symbol of the output asset (e.g., "APT")
 * @returns The conversion rate (1 FromAsset = X ToAsset)
 */
export async function getRealTimeConversionRate(
  fromSymbol: keyof typeof PRICE_FEEDS,
  toSymbol: keyof typeof PRICE_FEEDS
): Promise<number> {
  try {
    const connection = new AptosPriceServiceConnection(HERMES_URL);
    
    const feedIds = [PRICE_FEEDS[fromSymbol], PRICE_FEEDS[toSymbol]];
    const priceFeeds = await connection.getLatestPriceFeeds(feedIds);
    
    if (!priceFeeds || priceFeeds.length !== 2) {
      throw new Error("Failed to fetch price feeds from Pyth");
    }

    // Map feeds back to symbols
    // Note: getLatestPriceFeeds returns in requested order usually, but let's be safe if we could map by ID
    // The SDK returns PriceFeed objects. We need to match IDs.
    
    const fromFeed = priceFeeds.find(f => f.id === PRICE_FEEDS[fromSymbol]);
    const toFeed = priceFeeds.find(f => f.id === PRICE_FEEDS[toSymbol]);

    if (!fromFeed || !toFeed) {
      throw new Error("Price feed not found in response");
    }

    // Get unchecked prices (best available price)
    const fromPriceData = fromFeed.getPriceUnchecked();
    const toPriceData = toFeed.getPriceUnchecked();

    // Calculate actual prices (price * 10^expo)
    // Example: price=12345678, expo=-8 => 0.12345678
    const fromPrice = Number(fromPriceData.price) * Math.pow(10, fromPriceData.expo);
    const toPrice = Number(toPriceData.price) * Math.pow(10, toPriceData.expo);

    if (toPrice === 0) {
      throw new Error("Target asset price is zero");
    }

    // Calculate cross rate: (From/USD) / (To/USD)
    // Example: USDC=$1.00, APT=$10.00 => 1 USDC = 0.1 APT
    const rate = fromPrice / toPrice;

    console.log(`[Pyth] Rate: 1 ${fromSymbol} = ${rate} ${toSymbol} (${fromSymbol}=$${fromPrice}, ${toSymbol}=$${toPrice})`);

    return rate;

  } catch (error) {
    console.error("[Pyth] Failed to fetch conversion rate:", error);
    throw new Error(`Oracle failure: Unable to fetch real-time rate for ${fromSymbol}/${toSymbol}`);
  }
}
