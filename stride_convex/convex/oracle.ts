import { query } from "./_generated/server";
import { getUsdInrRate } from "./lib/oracle";

/**
 * Get the current INR/USD exchange rate.
 * Used by the frontend to display estimated conversion amounts.
 */
export const getExchangeRate = query({
  args: {},
  handler: async () => {
    try {
      const { rate, timestamp } = await getUsdInrRate();
      return {
        rate,
        timestamp,
        success: true
      };
    } catch (error) {
      console.error("Failed to fetch exchange rate for frontend:", error);
      return {
        rate: 0,
        timestamp: 0,
        success: false,
        error: "Failed to fetch live rate"
      };
    }
  },
});
