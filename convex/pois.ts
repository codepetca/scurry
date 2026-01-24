import { query, mutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { poiData, calculateBounds } from "./shared";

export const get = query({
  args: { id: v.id("pois") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const listByRace = query({
  args: { raceId: v.id("races") },
  handler: async (ctx, args) => {
    const pois = await ctx.db
      .query("pois")
      .withIndex("by_race", (q) => q.eq("raceId", args.raceId))
      .collect();
    // Sort by order
    return pois.sort((a, b) => a.order - b.order);
  },
});

/**
 * Calculate bounds from POIs and update race
 */
async function updateRaceBounds(ctx: MutationCtx, raceId: Id<"races">) {
  const pois = await ctx.db
    .query("pois")
    .withIndex("by_race", (q) => q.eq("raceId", raceId))
    .collect();

  if (pois.length === 0) return;

  const bounds = calculateBounds(pois);
  await ctx.db.patch(raceId, { bounds });
}

/**
 * Bulk create POIs for a race (replaces existing POIs)
 */
export const bulkCreate = mutation({
  args: {
    raceId: v.id("races"),
    pois: v.array(poiData),
  },
  handler: async (ctx, args) => {
    // Delete existing POIs
    const existing = await ctx.db
      .query("pois")
      .withIndex("by_race", (q) => q.eq("raceId", args.raceId))
      .collect();

    for (const poi of existing) {
      await ctx.db.delete(poi._id);
    }

    // Create new POIs
    const poiIds = [];
    for (let i = 0; i < args.pois.length; i++) {
      const poi = args.pois[i];
      const poiId = await ctx.db.insert("pois", {
        raceId: args.raceId,
        order: i + 1,
        lat: poi.lat,
        lng: poi.lng,
        name: poi.name,
        clue: poi.clue,
        validationType: poi.validationType,
      });
      poiIds.push(poiId);
    }

    // Update race bounds
    await updateRaceBounds(ctx, args.raceId);

    return poiIds;
  },
});

/**
 * Update a single POI
 */
export const update = mutation({
  args: {
    poiId: v.id("pois"),
    clue: v.optional(v.string()),
    name: v.optional(v.string()),
    lat: v.optional(v.number()),
    lng: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const poi = await ctx.db.get(args.poiId);
    if (!poi) {
      throw new Error("POI not found");
    }

    const updates: { clue?: string; name?: string; lat?: number; lng?: number } =
      {};
    if (args.clue !== undefined) updates.clue = args.clue;
    if (args.name !== undefined) updates.name = args.name;
    if (args.lat !== undefined) updates.lat = args.lat;
    if (args.lng !== undefined) updates.lng = args.lng;

    await ctx.db.patch(args.poiId, updates);

    // Update race bounds if position changed
    if (args.lat !== undefined || args.lng !== undefined) {
      await updateRaceBounds(ctx, poi.raceId);
    }
  },
});

/**
 * Remove a POI
 */
export const remove = mutation({
  args: {
    poiId: v.id("pois"),
  },
  handler: async (ctx, args) => {
    const poi = await ctx.db.get(args.poiId);
    if (!poi) {
      throw new Error("POI not found");
    }

    const raceId = poi.raceId;
    await ctx.db.delete(args.poiId);

    // Reorder remaining POIs
    const remaining = await ctx.db
      .query("pois")
      .withIndex("by_race", (q) => q.eq("raceId", raceId))
      .collect();

    const sorted = remaining.sort((a, b) => a.order - b.order);
    for (let i = 0; i < sorted.length; i++) {
      if (sorted[i].order !== i + 1) {
        await ctx.db.patch(sorted[i]._id, { order: i + 1 });
      }
    }

    // Update race bounds
    await updateRaceBounds(ctx, raceId);
  },
});

/**
 * Reorder POIs by updating their order values
 */
export const reorder = mutation({
  args: {
    updates: v.array(
      v.object({
        poiId: v.id("pois"),
        order: v.number(),
      })
    ),
  },
  handler: async (ctx, args) => {
    for (const update of args.updates) {
      const poi = await ctx.db.get(update.poiId);
      if (!poi) {
        throw new Error(`POI ${update.poiId} not found`);
      }
      await ctx.db.patch(update.poiId, { order: update.order });
    }
  },
});
