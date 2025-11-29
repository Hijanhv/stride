/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as actions_aptos from "../actions/aptos.js";
import type * as actions_geomi from "../actions/geomi.js";
import type * as actions_photon from "../actions/photon.js";
import type * as actions_razorpay from "../actions/razorpay.js";
import type * as actions_shelby from "../actions/shelby.js";
import type * as actions_treasury from "../actions/treasury.js";
import type * as constants from "../constants.js";
import type * as crons from "../crons.js";
import type * as http from "../http.js";
import type * as lib_decibel from "../lib/decibel.js";
import type * as lib_econia from "../lib/econia.js";
import type * as lib_oracle from "../lib/oracle.js";
import type * as oracle from "../oracle.js";
import type * as receipts from "../receipts.js";
import type * as rewards from "../rewards.js";
import type * as scheduler from "../scheduler.js";
import type * as sips from "../sips.js";
import type * as transactions from "../transactions.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "actions/aptos": typeof actions_aptos;
  "actions/geomi": typeof actions_geomi;
  "actions/photon": typeof actions_photon;
  "actions/razorpay": typeof actions_razorpay;
  "actions/shelby": typeof actions_shelby;
  "actions/treasury": typeof actions_treasury;
  constants: typeof constants;
  crons: typeof crons;
  http: typeof http;
  "lib/decibel": typeof lib_decibel;
  "lib/econia": typeof lib_econia;
  "lib/oracle": typeof lib_oracle;
  oracle: typeof oracle;
  receipts: typeof receipts;
  rewards: typeof rewards;
  scheduler: typeof scheduler;
  sips: typeof sips;
  transactions: typeof transactions;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
