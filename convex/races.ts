import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { poiData, calculateBounds } from "./shared";

/**
 * Create a new race with POIs
 */
export const createRace = mutation({
  args: {
    name: v.string(),
    description: v.string(),
    pois: v.array(poiData),
  },
  handler: async (ctx, args) => {
    if (args.pois.length < 2) {
      throw new Error("At least 2 POIs are required");
    }

    // Calculate bounds from POI positions
    const bounds = calculateBounds(args.pois);

    // Create the race
    const raceId = await ctx.db.insert("races", {
      name: args.name,
      description: args.description,
      bounds,
    });

    // Create all POIs
    for (let i = 0; i < args.pois.length; i++) {
      const poi = args.pois[i];
      await ctx.db.insert("pois", {
        raceId,
        order: i + 1,
        lat: poi.lat,
        lng: poi.lng,
        name: poi.name,
        clue: poi.clue,
        validationType: poi.validationType,
      });
    }

    return raceId;
  },
});

/**
 * Update race metadata only (name and description)
 */
export const updateRace = mutation({
  args: {
    raceId: v.id("races"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const race = await ctx.db.get(args.raceId);
    if (!race) {
      throw new Error("Race not found");
    }

    const updates: { name?: string; description?: string } = {};
    if (args.name !== undefined) updates.name = args.name;
    if (args.description !== undefined) updates.description = args.description;

    await ctx.db.patch(args.raceId, updates);
  },
});

/**
 * Atomically update race metadata and replace all POIs
 * This ensures race and POIs are updated together in a single transaction
 */
export const updateRaceWithPOIs = mutation({
  args: {
    raceId: v.id("races"),
    name: v.string(),
    description: v.string(),
    pois: v.array(poiData),
  },
  handler: async (ctx, args) => {
    const race = await ctx.db.get(args.raceId);
    if (!race) {
      throw new Error("Race not found");
    }

    if (args.pois.length < 2) {
      throw new Error("At least 2 POIs are required");
    }

    // Calculate bounds from POI positions
    const bounds = calculateBounds(args.pois);

    // Update race metadata and bounds
    await ctx.db.patch(args.raceId, {
      name: args.name,
      description: args.description,
      bounds,
    });

    // Delete existing POIs
    const existing = await ctx.db
      .query("pois")
      .withIndex("by_race", (q) => q.eq("raceId", args.raceId))
      .collect();

    for (const poi of existing) {
      await ctx.db.delete(poi._id);
    }

    // Create new POIs
    for (let i = 0; i < args.pois.length; i++) {
      const poi = args.pois[i];
      await ctx.db.insert("pois", {
        raceId: args.raceId,
        order: i + 1,
        lat: poi.lat,
        lng: poi.lng,
        name: poi.name,
        clue: poi.clue,
        validationType: poi.validationType,
      });
    }
  },
});

/**
 * Delete a race and all its POIs
 */
export const deleteRace = mutation({
  args: {
    raceId: v.id("races"),
  },
  handler: async (ctx, args) => {
    const race = await ctx.db.get(args.raceId);
    if (!race) {
      throw new Error("Race not found");
    }

    // Delete all POIs for this race
    const pois = await ctx.db
      .query("pois")
      .withIndex("by_race", (q) => q.eq("raceId", args.raceId))
      .collect();

    for (const poi of pois) {
      await ctx.db.delete(poi._id);
    }

    // Delete the race
    await ctx.db.delete(args.raceId);
  },
});

export const get = query({
  args: { id: v.id("races") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const getFirst = query({
  args: {},
  handler: async (ctx) => {
    // For MVP: just get the first race
    const races = await ctx.db.query("races").first();
    return races;
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("races").collect();
  },
});
