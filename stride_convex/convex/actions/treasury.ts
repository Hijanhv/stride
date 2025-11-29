"use node";

import { Aptos, AptosConfig, Ed25519Account, Ed25519PrivateKey, Network } from "@aptos-labs/ts-sdk";
import { v } from "convex/values";
import { internalAction } from "../_generated/server";
import { APTOS_FULLNODE_URL, CONTRACT_ADDRESS, IS_MAINNET, TOKENS } from "../constants";
import { convertInrToUsdc } from "../lib/oracle";

/**
 * Treasury Service
 * 
 * Bridges Fiat (INR) to Crypto (USDC).
 * 1. Calculates USDC equivalent of INR payment.
 * 2. Sends USDC from Treasury Wallet to User's SIP Vault.
 */

const TREASURY_PRIVATE_KEY = process.env.TREASURY_PRIVATE_KEY || process.env.SCHEDULER_PRIVATE_KEY || "";

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
    txHash: v.optional(v.string()),
    error: v.optional(v.string()),
  }),
  handler: async (ctx, args) => {
    console.log(`[Treasury] Processing funding for User ${args.userId} (₹${args.amountInr})`);

    if (!TREASURY_PRIVATE_KEY) {
      console.error("[Treasury] Private key not configured");
      return { success: false, error: "Treasury configuration missing" };
    }

    try {
      // 1. Calculate USDC Amount
      const usdcAmount = await convertInrToUsdc(args.amountInr);
      console.log(`[Treasury] Conversion: ₹${args.amountInr} => ${usdcAmount / 1000000} USDC`);

      // 2. Initialize Aptos
      const config = new AptosConfig({
        network: IS_MAINNET ? Network.MAINNET : Network.TESTNET,
        fullnode: APTOS_FULLNODE_URL,
      });
      const aptos = new Aptos(config);

      // 3. Initialize Treasury Account
      const privateKey = new Ed25519PrivateKey(TREASURY_PRIVATE_KEY);
      const treasuryAccount = new Ed25519Account({ privateKey });

      // 4. Send USDC to User's Vault
      // Note: We transfer to the Vault Object Address, not the User's Wallet Address
      // This ensures funds are locked for SIP execution
      
      // USDC Asset Type (using the one from constants)
      // For transfer, we usually use `0x1::aptos_account::transfer_coins` if it's a Coin,
      // or `0x1::primary_fungible_store::transfer` if it's FA.
      // Assuming standard FA or Coin. Let's use the generic transfer if possible, 
      // or specific Coin transfer. 
      // Since we are using "Moon Coin" or similar on testnet which might be a Coin:
      const coinType = TOKENS.USDC.address; 

      const transaction = await aptos.transaction.build.simple({
        sender: treasuryAccount.accountAddress,
        data: {
          function: `${CONTRACT_ADDRESS}::sip_vault::deposit_for_user`,
          typeArguments: [coinType],
          functionArguments: [args.vaultAddress, usdcAmount],
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
        throw new Error("On-chain transaction failed");
      }

      console.log(`[Treasury] Funding successful!`);

      return {
        success: true,
        usdcAmount,
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
