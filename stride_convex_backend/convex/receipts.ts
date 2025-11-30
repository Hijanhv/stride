import { v } from "convex/values";
import { internalMutation, internalQuery, query } from "./_generated/server";

/**
 * Receipts Management Module
 *
 * Handles storing and retrieving receipt references for Shelby storage.
 */

// ============================================================================
// TYPE VALIDATORS
// ============================================================================

const receiptTypeValidator = v.union(
  v.literal("sip_execution"),
  v.literal("deposit"),
  v.literal("withdrawal"),
  v.literal("monthly_report"),
  v.literal("tax_summary")
);

const receiptReturnValidator = v.object({
  _id: v.id("receipts"),
  _creationTime: v.number(),
  userId: v.id("users"),
  transactionId: v.optional(v.id("transactions")),
  sipId: v.optional(v.id("sips")),
  type: receiptTypeValidator,
  blobName: v.string(),
  blobUrl: v.optional(v.string()),
  contentType: v.string(),
  fileSize: v.optional(v.number()),
  summary: v.optional(v.string()),
  period: v.optional(v.string()),
  createdAt: v.number(),
  expiresAt: v.optional(v.number()),
});

// ============================================================================
// PUBLIC QUERIES
// ============================================================================

/**
 * Get all receipts for a user
 */
export const getByUser = query({
  args: {
    userId: v.id("users"),
    limit: v.optional(v.number()),
  },
  returns: v.array(receiptReturnValidator),
  handler: async (ctx, args) => {
    let receipts = await ctx.db
      .query("receipts")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect();

    if (args.limit) {
      receipts = receipts.slice(0, args.limit);
    }

    return receipts;
  },
});

/**
 * Get receipts by type
 */
export const getByType = query({
  args: {
    userId: v.id("users"),
    type: receiptTypeValidator,
    limit: v.optional(v.number()),
  },
  returns: v.array(receiptReturnValidator),
  handler: async (ctx, args) => {
    let receipts = await ctx.db
      .query("receipts")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    receipts = receipts.filter((r) => r.type === args.type);

    if (args.limit) {
      receipts = receipts.slice(0, args.limit);
    }

    return receipts;
  },
});

/**
 * Get a receipt by blob name
 */
export const getByBlobName = query({
  args: {
    blobName: v.string(),
  },
  returns: v.union(receiptReturnValidator, v.null()),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("receipts")
      .withIndex("by_blob_name", (q) => q.eq("blobName", args.blobName))
      .first();
  },
});

/**
 * Get monthly reports for a user
 */
export const getMonthlyReports = query({
  args: {
    userId: v.id("users"),
  },
  returns: v.array(receiptReturnValidator),
  handler: async (ctx, args) => {
    const receipts = await ctx.db
      .query("receipts")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();

    return receipts.filter((r) => r.type === "monthly_report");
  },
});

// ============================================================================
// INTERNAL MUTATIONS
// ============================================================================

/**
 * Create a new receipt record
 */
export const createReceipt = internalMutation({
  args: {
    userId: v.id("users"),
    transactionId: v.optional(v.id("transactions")),
    sipId: v.optional(v.id("sips")),
    type: receiptTypeValidator,
    blobName: v.string(),
    blobUrl: v.optional(v.string()),
    contentType: v.string(),
    fileSize: v.optional(v.number()),
    summary: v.optional(v.string()),
    period: v.optional(v.string()),
    expiresAt: v.optional(v.number()),
  },
  returns: v.id("receipts"),
  handler: async (ctx, args) => {
    const now = Date.now();

    return await ctx.db.insert("receipts", {
      userId: args.userId,
      transactionId: args.transactionId,
      sipId: args.sipId,
      type: args.type,
      blobName: args.blobName,
      blobUrl: args.blobUrl,
      contentType: args.contentType,
      fileSize: args.fileSize,
      summary: args.summary,
      period: args.period,
      createdAt: now,
      expiresAt: args.expiresAt,
    });
  },
});

/**
 * Update receipt with URL after upload
 */
export const updateReceiptUrl = internalMutation({
  args: {
    receiptId: v.id("receipts"),
    blobUrl: v.string(),
    fileSize: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.receiptId, {
      blobUrl: args.blobUrl,
      fileSize: args.fileSize,
    });
    return null;
  },
});

// ============================================================================
// INTERNAL QUERIES
// ============================================================================

/**
 * Get receipt by ID (internal)
 */
export const getByIdInternal = internalQuery({
  args: {
    receiptId: v.id("receipts"),
  },
  returns: v.union(receiptReturnValidator, v.null()),
  handler: async (ctx, args) => {
    return await ctx.db.get(args.receiptId);
  },
});

/**
 * Get receipts for a transaction (internal)
 */
export const getByTransactionInternal = internalQuery({
  args: {
    transactionId: v.id("transactions"),
  },
  returns: v.array(receiptReturnValidator),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("receipts")
      .withIndex("by_transaction", (q) =>
        q.eq("transactionId", args.transactionId)
      )
      .collect();
  },
});
