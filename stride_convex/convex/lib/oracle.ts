import axios from "axios";

/**
 * Oracle Service
 * 
 * Fetches real-time exchange rates for Fiat -> Crypto conversion.
 * Uses ExchangeRate-API (Reliable, Free Tier).
 * 
 * Source: https://api.exchangerate-api.com/v4/latest/USD
 */

const FOREX_API_URL = "https://api.exchangerate-api.com/v4/latest/USD";

export interface ExchangeRate {
  rate: number; // 1 USD = X INR
  timestamp: number;
  source: "exchangerate-api";
}

/**
 * Get the current USD to INR rate
 * Returns: How many INR for 1 USD (e.g., 84.5)
 * @throws Error if API fails (No hardcoded fallbacks allowed)
 */
export async function getUsdInrRate(): Promise<ExchangeRate> {
  try {
    const response = await axios.get(FOREX_API_URL, { timeout: 5000 });
    
    if (!response.data || !response.data.rates || !response.data.rates.INR) {
      throw new Error("Invalid response from Forex API");
    }

    const rate = response.data.rates.INR;
    
    return {
      rate,
      timestamp: response.data.time_last_updated || Date.now(),
      source: "exchangerate-api"
    };
  } catch (error) {
    console.error("Failed to fetch Forex rate:", error);
    // CRITICAL: Do not return a fallback. Fail the transaction.
    throw new Error("Unable to fetch real-time exchange rate. Please try again later.");
  }
}

/**
 * Convert INR to USDC
 * @param amountInr Amount in Rupees
 * @returns Amount in USDC (6 decimals)
 */
export async function convertInrToUsdc(amountInr: number): Promise<number> {
  const { rate } = await getUsdInrRate();
  
  // Formula: (INR / Rate) = USD
  const usdAmount = amountInr / rate;
  
  // Convert to USDC (6 decimals)
  // Floor to avoid precision issues
  return Math.floor(usdAmount * 1000000);
}
