/**
 * Environment Configuration Constants
 *
 * Centralized configuration for:
 * - Aptos Network (Testnet/Mainnet)
 * - Photon API
 * - Contract Addresses
 *
 * All values can be overridden via environment variables.
 */

// ============================================================================
// ENVIRONMENT DETECTION
// ============================================================================

export const ENVIRONMENT = process.env.ENVIRONMENT || "development";
export const IS_PRODUCTION = ENVIRONMENT === "production";
export const IS_DEVELOPMENT = ENVIRONMENT === "development";
export const IS_STAGING = ENVIRONMENT === "staging";

// ============================================================================
// APTOS NETWORK CONFIGURATION
// ============================================================================

/**
 * Aptos Network Selection
 * - testnet: For development and hackathons
 * - mainnet: For production
 * - devnet: For experimental features (resets frequently)
 */
export const APTOS_NETWORK =
  process.env.APTOS_NETWORK || (IS_PRODUCTION ? "mainnet" : "testnet");

/**
 * Aptos RPC Endpoints
 */
export const APTOS_RPC_URLS = {
  mainnet: "https://fullnode.mainnet.aptoslabs.com/v1",
  testnet: "https://fullnode.testnet.aptoslabs.com/v1",
  devnet: "https://fullnode.devnet.aptoslabs.com/v1",
} as const;

export const APTOS_RPC_URL =
  process.env.APTOS_RPC_URL ||
  APTOS_RPC_URLS[APTOS_NETWORK as keyof typeof APTOS_RPC_URLS] ||
  APTOS_RPC_URLS.testnet;

/**
 * Aptos Explorer URLs
 */
export const APTOS_EXPLORER_URLS = {
  mainnet: "https://explorer.aptoslabs.com",
  testnet: "https://explorer.aptoslabs.com?network=testnet",
  devnet: "https://explorer.aptoslabs.com?network=devnet",
} as const;

export const APTOS_EXPLORER_URL =
  APTOS_EXPLORER_URLS[APTOS_NETWORK as keyof typeof APTOS_EXPLORER_URLS] ||
  APTOS_EXPLORER_URLS.testnet;

// ============================================================================
// PHOTON API CONFIGURATION
// ============================================================================

/**
 * Photon API Base URLs
 * - Stage: For testing/hackathons (Aptos Testnet)
 * - Production: For production apps (Aptos Mainnet)
 */
export const PHOTON_API_URLS = {
  stage: "https://stage-api.getstan.app/identity-service/api/v1",
  production: "https://api.getstan.app/identity-service/api/v1",
} as const;

export const PHOTON_BASE_URL =
  process.env.PHOTON_BASE_URL ||
  (IS_PRODUCTION ? PHOTON_API_URLS.production : PHOTON_API_URLS.stage);

/**
 * Photon API Key
 */
export const PHOTON_API_KEY =
  process.env.PHOTON_API_KEY ||
  "7bc5d06eb53ad73716104742c7e8a5377da9fe8156378dcfebfb8253da4e8800";

/**
 * JWT Secret for Photon authentication
 */
export const PHOTON_JWT_SECRET =
  process.env.PHOTON_JWT_SECRET || "qwertyuiopasdfghjklzxcvbnm123456";

/**
 * Photon Campaign ID
 */
export const PHOTON_CAMPAIGN_ID =
  process.env.PHOTON_CAMPAIGN_ID || "ea3bcaca-9ce4-4b54-b803-8b9be1f142ba";

// ============================================================================
// PHOTON SMART CONTRACTS (APTOS TESTNET)
// ============================================================================

/**
 * Photon Smart Contract Addresses on Aptos Testnet
 * These are used for on-chain verification and balance checking
 */
export const PHOTON_CONTRACTS = {
  // User registration and identity management
  PhotonUsersModule:
    "0x1bd8cf2a60a2e3ac5f31541ba1b180d0b575a63a10fb0d0edbfc8ab99bb4b0b3",

  // Campaign rewards and token distribution
  PhotonCampaignManagerModule:
    "0x82373f661e43dae91d3bf13b9ec4bbed96be0348531628a8c0fe1099198f6bf1",

  // Event verification
  PhotonVerifier:
    "0x2e69240f3c02ce1932250aa0b52c5c989b16b710ce01039a0741192c4f08f5e9",
} as const;

// ============================================================================
// RUPAYA RAIL CONTRACT ADDRESSES
// ============================================================================

/**
 * Rupaya Rail Smart Contract Addresses
 * Update these after deploying contracts
 */
export const RUPAYA_CONTRACTS = {
  // SIP Vault contract for managing investments
  SIPVault: process.env.SIP_VAULT_ADDRESS || "",

  // Executor contract for batch SIP processing
  Executor: process.env.EXECUTOR_ADDRESS || "",

  // CLOB Market contract
  CLOBMarket: process.env.CLOB_MARKET_ADDRESS || "",

  // Rewards contract
  Rewards: process.env.REWARDS_ADDRESS || "",
} as const;

// ============================================================================
// TOKEN ADDRESSES
// ============================================================================

/**
 * Common token addresses on Aptos
 */
export const TOKEN_ADDRESSES = {
  // Native APT coin
  APT: "0x1::aptos_coin::AptosCoin",

  // PHOTON token (from Photon campaign)
  PHOTON: PHOTON_CONTRACTS.PhotonCampaignManagerModule,
} as const;

// ============================================================================
// TIMING CONSTANTS
// ============================================================================

/**
 * Time intervals in milliseconds
 */
export const TIME = {
  SECOND: 1000,
  MINUTE: 60 * 1000,
  HOUR: 60 * 60 * 1000,
  DAY: 24 * 60 * 60 * 1000,
  WEEK: 7 * 24 * 60 * 60 * 1000,
  MONTH: 30 * 24 * 60 * 60 * 1000, // Approximate
} as const;

/**
 * SIP frequency intervals
 */
export const SIP_INTERVALS = {
  daily: TIME.DAY,
  weekly: TIME.WEEK,
  monthly: TIME.MONTH,
} as const;

// ============================================================================
// LIMITS AND DEFAULTS
// ============================================================================

/**
 * Application limits
 */
export const LIMITS = {
  // Minimum SIP amount (in smallest unit)
  MIN_SIP_AMOUNT: 100,

  // Maximum SIP amount
  MAX_SIP_AMOUNT: 1000000,

  // Maximum active SIPs per user
  MAX_ACTIVE_SIPS: 10,

  // Token refresh buffer (refresh 5 minutes before expiry)
  TOKEN_REFRESH_BUFFER: 5 * TIME.MINUTE,
} as const;

// ============================================================================
// ERROR MESSAGES
// ============================================================================

export const ERRORS = {
  USER_NOT_FOUND: "User not found",
  SIP_NOT_FOUND: "SIP not found",
  INVALID_PHONE: "Invalid phone number",
  INVALID_AMOUNT: "Invalid amount",
  WALLET_NOT_FOUND: "Wallet not found",
  PHOTON_NOT_REGISTERED: "User not registered with Photon",
  TOKEN_EXPIRED: "Access token expired",
  INSUFFICIENT_BALANCE: "Insufficient balance",
  NETWORK_ERROR: "Network error occurred",
} as const;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get explorer URL for a transaction
 */
export function getTransactionExplorerUrl(txHash: string): string {
  return `${APTOS_EXPLORER_URL}/txn/${txHash}`;
}

/**
 * Get explorer URL for an account
 */
export function getAccountExplorerUrl(address: string): string {
  return `${APTOS_EXPLORER_URL}/account/${address}`;
}

/**
 * Check if we're running on testnet
 */
export function isTestnet(): boolean {
  return APTOS_NETWORK === "testnet";
}

/**
 * Check if we're running on mainnet
 */
export function isMainnet(): boolean {
  return APTOS_NETWORK === "mainnet";
}
