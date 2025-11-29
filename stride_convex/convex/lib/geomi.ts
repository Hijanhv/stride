import axios from "axios";
import { APTOS_INDEXER_API_KEY, GEOMI_INDEXER_GRAPHQL_URL } from "../constants";

/**
 * Geomi (Aptos Build) GraphQL Indexer Client
 *
 * This module provides a client for querying Aptos blockchain events via the
 * Geomi No-Code Indexer GraphQL endpoint.
 *
 * ARCHITECTURE NOTE:
 * Geomi does not currently support webhooks for real-time event notification.
 * Therefore, we implement an "Indexing" strategy via POLLING.
 *
 * How it works:
 * 1. The Geomi No-Code Indexer captures on-chain events from our smart contracts.
 * 2. These events are indexed and stored in a GraphQL-queryable database.
 * 3. Our Convex backend (via cron jobs or actions) polls this GraphQL endpoint.
 * 4. We fetch new events based on transaction version or timestamp.
 * 5. These events are then processed and stored/updated in our Convex database.
 *
 * Setup Required:
 * 1. Create No-Code Indexer project in Aptos Build dashboard
 * 2. Configure event sources (SIPExecuted, VaultCreated, etc.)
 * 3. Set GEOMI_INDEXER_GRAPHQL_URL and APTOS_INDEXER_API_KEY in .env
 */

// ============================================================================
// TYPES
// ============================================================================

export interface SIPExecutedEvent {
  vault_addr: string;
  sip_id: number;
  amount_in: string;
  amount_out: string;
  execution_count: number;
  timestamp: string;
  transaction_version: string;
  transaction_hash?: string;
}

export interface VaultCreatedEvent {
  user: string;
  vault_addr: string;
  timestamp: string;
  transaction_version: string;
}

export interface DepositEvent {
  vault_addr: string;
  user: string;
  amount: string;
  asset: string;
  timestamp: string;
  transaction_version: string;
}

export interface SIPCreatedEvent {
  user: string;
  vault_addr: string;
  sip_id: number;
  amount_in: string;
  frequency_seconds: number;
  target_asset: string;
  name: string;
  timestamp: string;
  transaction_version: string;
}

export interface SwapPendingEvent {
  vault_addr: string;
  vault_owner: string;
  sip_index: number;
  input_asset: string;
  target_asset: string;
  amount_in: string;
  timestamp: string;
  transaction_version: string;
}

export interface SwapExecutedEvent {
  vault_addr: string;
  input_asset: string;
  output_asset: string;
  amount_in: string;
  amount_out: string;
  market_id: string;
  timestamp: string;
  transaction_version: string;
}

export interface ExecutionSummary {
  vaultAddress: string;
  sipIndex: number;
  amountIn: number;
  amountOut: number;
  rewardPoints: number;
  timestamp: string;
  txVersion: string;
}

// ============================================================================
// GRAPHQL QUERIES
// ============================================================================

const QUERY_SIP_EXECUTED = `
  query GetSIPExecutedEvents($sinceVersion: bigint, $limit: Int!) {
    sip_executed_events(
      where: { transaction_version: { _gt: $sinceVersion } }
      order_by: { transaction_version: asc }
      limit: $limit
    ) {
      vault_addr
      sip_id
      amount_in
      amount_out
      execution_count
      timestamp
      transaction_version
    }
  }
`;

const QUERY_VAULT_CREATED = `
  query GetVaultCreatedEvents($sinceVersion: bigint, $limit: Int!) {
    vault_created_events(
      where: { transaction_version: { _gt: $sinceVersion } }
      order_by: { transaction_version: asc }
      limit: $limit
    ) {
      user
      vault_addr
      timestamp
      transaction_version
    }
  }
`;

const QUERY_DEPOSITS = `
  query GetDepositEvents($sinceVersion: bigint, $limit: Int!) {
    deposit_events(
      where: { transaction_version: { _gt: $sinceVersion } }
      order_by: { transaction_version: asc }
      limit: $limit
    ) {
      vault_addr
      user
      amount
      asset
      timestamp
      transaction_version
    }
  }
`;

const QUERY_SIP_CREATED = `
  query GetSIPCreatedEvents($sinceVersion: bigint, $limit: Int!) {
    sip_created_events(
      where: { transaction_version: { _gt: $sinceVersion } }
      order_by: { transaction_version: asc }
      limit: $limit
    ) {
      user
      vault_addr
      sip_id
      amount_in
      frequency_seconds
      target_asset
      name
      timestamp
      transaction_version
    }
  }
`;

const QUERY_SIP_EXECUTED_BY_VAULT = `
  query GetSIPExecutionsByVault($vaultAddress: String, $limit: Int) {
    sip_executed_events(
      where: { vault_address: { _eq: $vaultAddress } }
      order_by: { timestamp: desc }
      limit: $limit
    ) {
      vault_address
      sip_index
      amount_in
      amount_out
      execution_count
      timestamp
      transaction_hash
      transaction_version
    }
  }
`;

const QUERY_RECENT_SIP_EXECUTED = `
  query GetRecentSIPExecutions($limit: Int!) {
    sip_executed_events(
      order_by: { timestamp: desc }
      limit: $limit
    ) {
      vault_address
      sip_index
      amount_in
      amount_out
      execution_count
      timestamp
      transaction_hash
      transaction_version
    }
  }
`;

const QUERY_SWAP_PENDING = `
  query GetSwapPending($sinceVersion: bigint, $limit: Int!) {
    stride_swap_pending_events(
      where: { transaction_version: { _gt: $sinceVersion } }
      order_by: { transaction_version: asc }
      limit: $limit
    ) {
      vault_addr
      vault_owner
      sip_index
      input_asset
      target_asset
      amount_in
      timestamp
      transaction_version
    }
  }
`;

const QUERY_SWAP_EXECUTED = `
  query GetSwapExecuted($sinceVersion: bigint, $limit: Int!) {
    stride_swap_executed_events(
      where: { transaction_version: { _gt: $sinceVersion } }
      order_by: { transaction_version: asc }
      limit: $limit
    ) {
      vault_addr
      input_asset
      output_asset
      amount_in
      amount_out
      market_id
      timestamp
      transaction_version
    }
  }
`;

// ============================================================================
// QUERY FUNCTIONS
// ============================================================================

/**
 * Execute a GraphQL query against the Geomi indexer
 */
export async function executeGeomiQuery(query: string, variables: any): Promise<any> {
  if (!GEOMI_INDEXER_GRAPHQL_URL) {
    console.warn("[Geomi] GraphQL URL not configured. Skipping query.");
    return null;
  }

  try {
    const response = await axios.post(
      GEOMI_INDEXER_GRAPHQL_URL,
      {
        query,
        variables,
      },
      {
        headers: {
          "Content-Type": "application/json",
          ...(APTOS_INDEXER_API_KEY && {
            Authorization: `Bearer ${APTOS_INDEXER_API_KEY}`,
          }),
        },
        timeout: 15000,
      }
    );

    if (response.data.errors) {
      console.error("[Geomi] GraphQL errors:", response.data.errors);
      throw new Error(response.data.errors[0].message);
    }

    return response.data.data;
  } catch (error) {
    console.error("[Geomi] Query failed:", error);
    throw error;
  }
}

/**
 * Fetch SIP Executed events since a specific transaction version
 */
export async function fetchSIPExecutedEvents(sinceVersion: string, limit: number): Promise<SIPExecutedEvent[]> {
  const data = await executeGeomiQuery(QUERY_SIP_EXECUTED, {
    sinceVersion,
    limit,
  });

  return data?.sip_executed_events || [];
}

/**
 * Fetch Vault Created events since a specific transaction version
 */
export async function fetchVaultCreatedEvents(sinceVersion: string, limit: number): Promise<VaultCreatedEvent[]> {
  const data = await executeGeomiQuery(QUERY_VAULT_CREATED, {
    sinceVersion,
    limit,
  });

  return data?.vault_created_events || [];
}

/**
 * Fetch Deposit events since a specific transaction version
 */
export async function fetchDepositEvents(sinceVersion: string, limit: number): Promise<DepositEvent[]> {
  const data = await executeGeomiQuery(QUERY_DEPOSITS, {
    sinceVersion,
    limit,
  });

  return data?.deposit_events || [];
}

/**
 * Fetch SIP Created events since a specific transaction version
 */
export async function fetchSIPCreatedEvents(sinceVersion: string, limit: number): Promise<SIPCreatedEvent[]> {
  const data = await executeGeomiQuery(QUERY_SIP_CREATED, {
    sinceVersion,
    limit,
  });

  return data?.sip_created_events || [];
}

/**
 * Fetch SIP Executed events by Vault Address
 */
export async function fetchSIPExecutionsByVault(vaultAddress: string, limit: number): Promise<SIPExecutedEvent[]> {
  const data = await executeGeomiQuery(QUERY_SIP_EXECUTED_BY_VAULT, {
    vaultAddress,
    limit,
  });

  return data?.sip_executed_events || [];
}

/**
 * Fetch Recent SIP Executed events
 */
export async function fetchRecentSIPExecutions(limit: number): Promise<SIPExecutedEvent[]> {
  const data = await executeGeomiQuery(QUERY_RECENT_SIP_EXECUTED, {
    limit,
  });

  return data?.sip_executed_events || [];
}

/**
 * Fetch swap pending events (for backend to process DEX swaps)
 */
export async function fetchSwapPendingEvents(sinceVersion: string, limit: number): Promise<SwapPendingEvent[]> {
  const data = await executeGeomiQuery(QUERY_SWAP_PENDING, {
    sinceVersion,
    limit,
  });

  return data?.stride_swap_pending_events || [];
}

/**
 * Fetch swap executed events
 */
export async function fetchSwapExecutedEvents(sinceVersion: string, limit: number): Promise<SwapExecutedEvent[]> {
  const data = await executeGeomiQuery(QUERY_SWAP_EXECUTED, {
    sinceVersion,
    limit,
  });

  return data?.stride_swap_executed_events || [];
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Aggregate executions by vault
 * Useful for calculating total DCA statistics
 */
export function aggregateExecutionsByVault(
  executions: SIPExecutedEvent[]
): Map<string, ExecutionSummary[]> {
  const vaultMap = new Map<string, ExecutionSummary[]>();

  for (const exec of executions) {
    const vaultAddr = exec.vault_addr;

    const summary: ExecutionSummary = {
      vaultAddress: exec.vault_addr,
      sipIndex: exec.sip_id,
      amountIn: parseFloat(exec.amount_in),
      amountOut: parseFloat(exec.amount_out),
      rewardPoints: 0, // Not available in this event type
      timestamp: exec.timestamp,
      txVersion: exec.transaction_version,
    };

    if (!vaultMap.has(vaultAddr)) {
      vaultMap.set(vaultAddr, [summary]);
    } else {
      vaultMap.get(vaultAddr)!.push(summary);
    }
  }

  return vaultMap;
}

/**
 * Calculate DCA statistics from execution events
 */
export function calculateDCAStats(executions: ExecutionSummary[]): {
  totalInvested: number;
  totalReceived: number;
  averagePrice: number;
  executionCount: number;
  totalRewards: number;
} {
  let totalInvested = 0;
  let totalReceived = 0;
  let totalRewards = 0;

  for (const exec of executions) {
    totalInvested += exec.amountIn;
    totalReceived += exec.amountOut;
    totalRewards += exec.rewardPoints;
  }

  const averagePrice = totalReceived > 0 ? totalInvested / totalReceived : 0;

  return {
    totalInvested,
    totalReceived,
    averagePrice,
    executionCount: executions.length,
    totalRewards,
  };
}

/**
 * Helper: Parse amount from contract (handles different decimal formats)
 */
export function parseContractAmount(
  amount: string | number,
  decimals: number = 8
): number {
  const raw = typeof amount === "string" ? parseFloat(amount) : amount;
  return raw / Math.pow(10, decimals);
}

/**
 * Helper: Format amount for display
 */
export function formatAmount(amount: number, decimals: number = 2): string {
  return amount.toFixed(decimals);
}
