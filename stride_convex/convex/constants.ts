/**
 * Stride Constants
 *
 * Central configuration for all API keys, contract addresses, and settings.
 * These should be set via environment variables in production.
 */

// ============================================================================
// NETWORK CONFIGURATION
// ============================================================================

export const NETWORK = process.env.APTOS_NETWORK || "testnet";
export const IS_TESTNET = NETWORK === "testnet";
export const IS_MAINNET = NETWORK === "mainnet";

// ============================================================================
// APTOS API CONFIGURATION (Geomi/Aptos Build)
// ============================================================================

// Full Node API Key from Aptos Build
export const APTOS_API_KEY = process.env.APTOS_API_KEY || "";

// Gas Station API Key for sponsoring transactions
export const APTOS_GAS_STATION_API_KEY =
  process.env.APTOS_GAS_STATION_API_KEY || "";

// No-Code Indexer API Key
export const APTOS_INDEXER_API_KEY = process.env.APTOS_INDEXER_API_KEY || "";

// RPC URLs
export const APTOS_RPC_URL = IS_MAINNET
  ? "https://api.mainnet.aptoslabs.com/v1"
  : "https://api.testnet.aptoslabs.com/v1";

export const APTOS_FULLNODE_URL = IS_MAINNET
  ? "https://fullnode.mainnet.aptoslabs.com/v1"
  : "https://fullnode.testnet.aptoslabs.com/v1";

export const APTOS_INDEXER_URL = process.env.APTOS_INDEXER_URL || "";

// Geomi Indexer GraphQL endpoint
export const GEOMI_INDEXER_GRAPHQL_URL =
  process.env.GEOMI_INDEXER_GRAPHQL_URL || "";

// Webhook URL for Geomi to send events (configure in Geomi dashboard)
export const GEOMI_WEBHOOK_URL = process.env.GEOMI_WEBHOOK_URL || "";

// ============================================================================
// DECIBEL CLOB CONFIGURATION
// ============================================================================

// Decibel contract addresses
// Decibel contract addresses (Defaults to Econia Testnet)
// Source: Econia Docs (Testnet)
export const DECIBEL_CONFIG = {
  PACKAGE_ADDRESS: process.env.DECIBEL_PACKAGE_ADDRESS || "0xc0deb00c9154b6b64db01e277648f5bd694cecc703fd0d9053fb95a58b292b17", // Econia Testnet
  MARKET_REGISTRY: process.env.DECIBEL_MARKET_REGISTRY || "0xc0deb00c9154b6b64db01e277648f5bd694cecc703fd0d9053fb95a58b292b17",
  USDC_APT_MARKET_ID: process.env.DECIBEL_USDC_APT_MARKET_ID || "0x1::aptos_coin::AptosCoin-0x1::aptos_coin::AptosCoin", // Placeholder
  MARKETS: {
    USDC_APT: process.env.DECIBEL_USDC_APT_MARKET_ID || "0x1::aptos_coin::AptosCoin-0x1::aptos_coin::AptosCoin",
  },
  API_URL: "https://api.testnet.econia.dev/v1",
};

// Validation: Warn instead of fail for missing secrets in dev
if (!process.env.DECIBEL_PACKAGE_ADDRESS) {
  console.warn("⚠️ DECIBEL_PACKAGE_ADDRESS is missing. Using Econia Testnet defaults.");
}

// ============================================================================
// SMART CONTRACT ADDRESSES
// ============================================================================

// Deployed contract address
export const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || "";

// Module names
export const MODULES = {
  SIP_VAULT: `${CONTRACT_ADDRESS}::sip_vault`,
  EXECUTOR: `${CONTRACT_ADDRESS}::executor`,
  CLOB_MARKET: `${CONTRACT_ADDRESS}::clob_market`,
  REWARDS: `${CONTRACT_ADDRESS}::rewards`,
};

// Entry functions
export const ENTRY_FUNCTIONS = {
  // SIP Vault
  CREATE_VAULT: `${MODULES.SIP_VAULT}::create_vault`,
  DEPOSIT: `${MODULES.SIP_VAULT}::deposit`,
  CREATE_SIP: `${MODULES.SIP_VAULT}::create_sip`,
  UPDATE_SIP_AMOUNT: `${MODULES.SIP_VAULT}::update_sip_amount`,
  PAUSE_SIP: `${MODULES.SIP_VAULT}::pause_sip`,
  RESUME_SIP: `${MODULES.SIP_VAULT}::resume_sip`,
  CANCEL_SIP: `${MODULES.SIP_VAULT}::cancel_sip`,
  WITHDRAW: `${MODULES.SIP_VAULT}::withdraw`,

  // Executor
  EXECUTE_SIP: `${MODULES.EXECUTOR}::execute_sip`,
  EXECUTE_BATCH: `${MODULES.EXECUTOR}::execute_batch`,
  EXECUTE_SIP_WITH_SLIPPAGE: `${MODULES.EXECUTOR}::execute_sip_with_slippage`,

  // Rewards
  REGISTER_REWARDS: `${MODULES.REWARDS}::register`,
  REDEEM_POINTS: `${MODULES.REWARDS}::redeem_points`,
};

// View functions
export const VIEW_FUNCTIONS = {
  GET_DCA_STATISTICS: `${MODULES.SIP_VAULT}::get_dca_statistics`,
  GET_VAULT_OWNER: `${MODULES.SIP_VAULT}::get_vault_owner`,
  GET_SIP_COUNT: `${MODULES.SIP_VAULT}::get_sip_count`,
  GET_VAULT_STATS: `${MODULES.SIP_VAULT}::get_vault_stats`,
  IS_SIP_DUE: `${MODULES.SIP_VAULT}::is_sip_due`,
  GET_SIP_DETAILS: `${MODULES.SIP_VAULT}::get_sip_details`,
  GET_POINTS: `${MODULES.REWARDS}::get_points`,
  GET_REWARD_STATS: `${MODULES.REWARDS}::get_reward_stats`,
  GET_TIER: `${MODULES.REWARDS}::get_tier`,
  IS_REGISTERED: `${MODULES.REWARDS}::is_registered`,
};

// ============================================================================
// PHOTON API CONFIGURATION
// ============================================================================

export const PHOTON_CONFIG = {
  BASE_URL: IS_MAINNET
    ? "https://api.getstan.app/identity-service/api/v1"
    : "https://stage-api.getstan.app/identity-service/api/v1",

  API_KEY: process.env.PHOTON_API_KEY || "",

  JWT_SECRET: process.env.PHOTON_JWT_SECRET || "",

  CAMPAIGN_ID: process.env.PHOTON_CAMPAIGN_ID || "",
};

// ============================================================================
// WALLET CONFIGURATION
// ============================================================================

export const WALLET_CONFIG = {
  // Private key for the scheduler bot that executes SIPs
  SCHEDULER_PRIVATE_KEY: process.env.SCHEDULER_PRIVATE_KEY || "",
};

// ============================================================================
// RAZORPAY CONFIGURATION (UPI Payments)
// ============================================================================

export const RAZORPAY_CONFIG = {
  KEY_ID: process.env.RAZORPAY_KEY_ID || "",
  KEY_SECRET: process.env.RAZORPAY_KEY_SECRET || "",
  WEBHOOK_SECRET: process.env.RAZORPAY_WEBHOOK_SECRET || "",
  // Test mode credentials (for development)
  TEST_KEY_ID: process.env.RAZORPAY_TEST_KEY_ID || "",
  TEST_KEY_SECRET: process.env.RAZORPAY_TEST_KEY_SECRET || "",
};

// ============================================================================
// SHELBY CONFIGURATION (Receipt Storage)
// ============================================================================

export const SHELBY_CONFIG = {
  API_URL: process.env.SHELBY_API_URL || "https://api.shelby.dev/v1",
  API_KEY: process.env.SHELBY_API_KEY || "",
  BUCKET_NAME: process.env.SHELBY_BUCKET_NAME || "stride-receipts",
};

// ============================================================================
// TOKEN CONFIGURATION
// ============================================================================

// Test USDC on Aptos Testnet (Moon Coin for testing)
export const TOKENS = {
  // Native APT
  APT: {
    symbol: "APT",
    name: "Aptos",
    decimals: 8,
    address: "0x1::aptos_coin::AptosCoin",
    metadata: "0x1::aptos_coin::AptosCoin",
  },

  // Test USDC (using Moon Coin as placeholder on testnet)
  USDC: {
    symbol: "USDC",
    name: "USD Coin",
    decimals: 6,
    // Testnet faucet coin or mock USDC address
    address: "0x1::aptos_coin::AptosCoin", // Using APT as placeholder
    metadata: "0x1::aptos_coin::AptosCoin",
  },

  // Photon token (from campaign rewards)
  PHOTON: {
    symbol: "PHOTON",
    name: "Photon Token",
    decimals: 8,
    address: "", // Set after campaign is deployed
    metadata: "",
  },
};

// ============================================================================
// SIP CONFIGURATION
// ============================================================================

export const SIP_CONFIG = {
  // Minimum amounts
  MIN_AMOUNT_INR: 100, // ₹100 minimum
  MIN_AMOUNT_USDC: 1000000, // 1 USDC (6 decimals)

  // Frequency options (in seconds)
  FREQUENCIES: {
    HOURLY: 3600, // 1 hour (for testing)
    DAILY: 86400, // 24 hours
    WEEKLY: 604800, // 7 days
    BIWEEKLY: 1209600, // 14 days
    MONTHLY: 2592000, // 30 days
  },

  // Reward rates (points per unit invested)
  REWARD_RATE: 0.1, // 10% in points

  // Streak bonuses
  STREAK_BONUS_PER_DAY: 10,
  MAX_STREAK_BONUS: 100,
};

// ============================================================================
// UPI CONFIGURATION
// ============================================================================

export const UPI_CONFIG = {
  // UPI VPA for receiving payments
  VPA: process.env.UPI_VPA || "",

  // Merchant details
  MERCHANT_NAME: "Stride",
  MERCHANT_CODE: "5411", // Financial services

  // Payment limits
  MIN_AMOUNT: 100, // ₹100
  MAX_AMOUNT: 100000, // ₹1,00,000
};

// ============================================================================
// GAS STATION CONFIGURATION
// ============================================================================

export const GAS_STATION_CONFIG = {
  // Functions to sponsor
  SPONSORED_FUNCTIONS: [
    `${CONTRACT_ADDRESS}::sip_vault::create_vault`,
    `${CONTRACT_ADDRESS}::sip_vault::deposit`,
    `${CONTRACT_ADDRESS}::sip_vault::create_sip`,
    `${CONTRACT_ADDRESS}::sip_vault::update_sip_amount`,
    `${CONTRACT_ADDRESS}::sip_vault::pause_sip`,
    `${CONTRACT_ADDRESS}::sip_vault::resume_sip`,
    `${CONTRACT_ADDRESS}::executor::execute_sip`,
    `${CONTRACT_ADDRESS}::rewards::register`,
  ],

  // Max gas per transaction
  MAX_GAS_AMOUNT: 10000,

  // Gas unit price
  GAS_UNIT_PRICE: 100,
};

// ============================================================================
// RATE LIMITING
// ============================================================================

export const RATE_LIMITS = {
  // API calls per minute
  API_CALLS_PER_MINUTE: 100,

  // SIP executions per hour
  SIP_EXECUTIONS_PER_HOUR: 60,

  // Reward claims per day
  REWARD_CLAIMS_PER_DAY: 10,
};

// ============================================================================
// ERROR CODES
// ============================================================================

export const ERROR_CODES = {
  // User errors
  USER_NOT_FOUND: "USER_NOT_FOUND",
  USER_NOT_REGISTERED: "USER_NOT_REGISTERED",
  INVALID_PHONE: "INVALID_PHONE",

  // SIP errors
  SIP_NOT_FOUND: "SIP_NOT_FOUND",
  SIP_NOT_DUE: "SIP_NOT_DUE",
  INSUFFICIENT_BALANCE: "INSUFFICIENT_BALANCE",

  // Transaction errors
  TX_FAILED: "TX_FAILED",
  TX_TIMEOUT: "TX_TIMEOUT",

  // API errors
  PHOTON_ERROR: "PHOTON_ERROR",
  APTOS_ERROR: "APTOS_ERROR",
  SHELBY_ERROR: "SHELBY_ERROR",
};
