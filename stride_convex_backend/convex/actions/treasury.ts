"use node";

import {
  Aptos,
  AptosConfig,
  Ed25519Account,
  Ed25519PrivateKey,
  Network,
} from "@aptos-labs/ts-sdk";
import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import {
  APTOS_FULLNODE_URL,
  CONTRACT_ADDRESS,
  IS_MAINNET,
  TOKENS,
} from "../constants";
import { convertInrToUsdc } from "../lib/oracle";
import { getRealTimeConversionRate } from "../lib/pyth";

/**
 * Treasury Service
 *
 * Bridges Fiat (INR) to Crypto (USDC/APT).
 * 1. Calculates USDC equivalent of INR payment.
 * 2. Sends funds from Treasury Wallet to User's SIP Vault.
 *
 * ARCHITECTURE:
 * - On testnet, we use APT as the input token (since USDC isn't available)
 * - The deposit_for_user function requires treasury to be authorized via access_control
 * - Treasury must have sufficient balance to fund user vaults
 */

const TREASURY_PRIVATE_KEY =
  process.env.TREASURY_PRIVATE_KEY || process.env.SCHEDULER_PRIVATE_KEY || "";

/**
 * Fund a user's vault with the equivalent amount after INR conversion
 *
 * Flow:
 * 1. User pays INR via Razorpay
 * 2. Backend converts INR to USDC equivalent
 * 3. Treasury deposits funds to user's vault
 * 4. User can now execute SIPs from their vault
 */
export const fundUserVault = internalAction({
  args: {
    userId: v.id("users"),
    amountInr: v.number(), // in Rupees
    razorpayPaymentId: v.string(),
    vaultAddress: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    usdcAmount: v.optional(v.number()),
    aptAmount: v.optional(v.number()),
    txHash: v.optional(v.string()),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    console.log(
      `[Treasury] Processing funding for User ${args.userId} (₹${args.amountInr})`
    );

    if (!TREASURY_PRIVATE_KEY) {
      console.error("[Treasury] Private key not configured");
      return { success: false, error: "Treasury configuration missing" };
    }

    try {
      // 1. Calculate USDC Amount (6 decimals)
      const usdcAmount = await convertInrToUsdc(args.amountInr);
      console.log(
        `[Treasury] Conversion: ₹${args.amountInr} => ${usdcAmount / 1_000_000} USDC`
      );

      // 2. Convert USDC to APT using Pyth Oracle
      // Fetch real-time rate from Pyth Hermes
      const conversionRate = await getRealTimeConversionRate("USDC", "APT");
      
      // Calculate APT amount (8 decimals)
      // Formula: (USDC / 10^6) * Rate * 10^8
      const aptAmount = Math.floor(
        (usdcAmount / 1_000_000) * conversionRate * 100_000_000
      );
      console.log(
        `[Treasury] Testnet APT equivalent: ${aptAmount / 100_000_000} APT`
      );

      // 3. Initialize Aptos
      const config = new AptosConfig({
        network: IS_MAINNET ? Network.MAINNET : Network.TESTNET,
        fullnode: APTOS_FULLNODE_URL,
      });
      const aptos = new Aptos(config);

      // 4. Initialize Treasury Account
      const privateKey = new Ed25519PrivateKey(TREASURY_PRIVATE_KEY);
      const treasuryAccount = new Ed25519Account({ privateKey });

      // 5. Get admin address for access control verification
      const adminAddress = CONTRACT_ADDRESS;

      // 6. Build transaction to deposit funds to user's vault
      // Using APT on testnet (AptosCoin)
      const coinType = TOKENS.APT.address; // "0x1::aptos_coin::AptosCoin"

      const transaction = await aptos.transaction.build.simple({
        sender: treasuryAccount.accountAddress,
        data: {
          function: `${CONTRACT_ADDRESS}::sip_vault::deposit_for_user`,
          typeArguments: [coinType],
          functionArguments: [
            args.vaultAddress, // vault_obj: Object<Vault>
            aptAmount.toString(), // amount: u64
            adminAddress, // admin_addr: address (for access control)
          ],
        },
      });

      const pendingTx = await aptos.signAndSubmitTransaction({
        signer: treasuryAccount,
        transaction,
      });

      console.log(`[Treasury] Transaction submitted: ${pendingTx.hash}`);

      const executedTx = await aptos.waitForTransaction({
        transactionHash: pendingTx.hash,
      });

      if (!executedTx.success) {
        throw new Error(`On-chain transaction failed: ${executedTx.vm_status}`);
      }

      console.log(`[Treasury] Funding successful! TxHash: ${executedTx.hash}`);

      return {
        success: true,
        usdcAmount,
        aptAmount,
        txHash: executedTx.hash,
      };
    } catch (error: any) {
      console.error("[Treasury] Funding failed:", error);
      return {
        success: false,
        error: error.message || "Unknown treasury error",
      };
    }
  },
});

/**
 * Direct APT transfer to vault (simpler approach for testnet)
 * Uses standard Aptos transfer instead of contract call
 */
export const fundUserVaultDirect = internalAction({
  args: {
    userId: v.id("users"),
    amountApt: v.number(), // in APT (human readable, e.g., 0.5)
    vaultAddress: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    txHash: v.optional(v.string()),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    console.log(
      `[Treasury] Direct funding for User ${args.userId} (${args.amountApt} APT)`
    );

    if (!TREASURY_PRIVATE_KEY) {
      console.error("[Treasury] Private key not configured");
      return { success: false, error: "Treasury configuration missing" };
    }

    try {
      // Convert to octas (8 decimals)
      const amountOctas = Math.floor(args.amountApt * 100_000_000);

      // Initialize Aptos
      const config = new AptosConfig({
        network: IS_MAINNET ? Network.MAINNET : Network.TESTNET,
        fullnode: APTOS_FULLNODE_URL,
      });
      const aptos = new Aptos(config);

      // Initialize Treasury Account
      const privateKey = new Ed25519PrivateKey(TREASURY_PRIVATE_KEY);
      const treasuryAccount = new Ed25519Account({ privateKey });

      // Simple APT transfer to vault address
      const transaction = await aptos.transaction.build.simple({
        sender: treasuryAccount.accountAddress,
        data: {
          function: "0x1::aptos_account::transfer",
          typeArguments: [],
          functionArguments: [args.vaultAddress, amountOctas.toString()],
        },
      });

      const pendingTx = await aptos.signAndSubmitTransaction({
        signer: treasuryAccount,
        transaction,
      });

      console.log(`[Treasury] Direct transfer submitted: ${pendingTx.hash}`);

      const executedTx = await aptos.waitForTransaction({
        transactionHash: pendingTx.hash,
      });

      if (!executedTx.success) {
        throw new Error(`Transfer failed: ${executedTx.vm_status}`);
      }

      console.log(`[Treasury] Direct funding successful!`);

      return {
        success: true,
        txHash: executedTx.hash,
      };
    } catch (error: any) {
      console.error("[Treasury] Direct funding failed:", error);
      return {
        success: false,
        error: error.message || "Unknown treasury error",
      };
    }
  },
});
