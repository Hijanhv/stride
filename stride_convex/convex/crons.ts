import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

/**
 * Cron Jobs Configuration
 *
 * Scheduled tasks for automated operations:
 * - SIP execution (every 5 minutes)
 * - Blockchain event sync (hourly backup)
 */

const crons = cronJobs();

// ============================================================================
// SIP EXECUTION
// ============================================================================

/**
 * Execute due SIPs
 * Runs every 5 minutes to check for and execute SIPs that are due
 */
crons.interval(
  "execute-sips",
  { minutes: 5 }, // Check every 5 minutes for due SIPs
  internal.scheduler.executeBatch
);

// ============================================================================
// BLOCKCHAIN SYNC (Backup for webhooks)
// ============================================================================

/**
 * Sync blockchain events from Geomi Indexer
 * Runs hourly as a backup to webhooks
 * Ensures no events are missed if webhook fails
 */
crons.interval(
  "sync-blockchain-events",
  { hours: 1 }, // Hourly sync
  internal.actions.geomi.syncBlockchainEvents
);

// ============================================================================
// SWAP EXECUTION
// ============================================================================

/**
 * Process pending swaps and execute via Decibel
 * Polls for SwapPending events and executes DEX swaps
 */
crons.interval(
  "process-pending-swaps",
  { minutes: 1 }, // Check every minute for pending swaps
  internal.actions.decibel.processPendingSwaps
);

export default crons;
