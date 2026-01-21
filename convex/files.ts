import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

export const getUrl = query({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    return await ctx.storage.getUrl(args.storageId);
  },
});

// Batch query to get multiple photo URLs at once (reduces N+1 queries)
export const getUrls = query({
  args: { storageIds: v.array(v.id("_storage")) },
  handler: async (ctx, args) => {
    const urls: Record<string, string | null> = {};
    await Promise.all(
      args.storageIds.map(async (storageId) => {
        urls[storageId] = await ctx.storage.getUrl(storageId);
      })
    );
    return urls;
  },
});
