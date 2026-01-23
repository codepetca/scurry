import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// POI data for creating a race
const poiData = v.object({
  lat: v.number(),
  lng: v.number(),
  name: v.optional(v.string()),
  clue: v.string(),
  validationType: v.union(
    v.literal("PHOTO_ONLY"),
    v.literal("GPS_RADIUS"),
    v.literal("QR_CODE"),
    v.literal("MANUAL")
  ),
});

/**
 * Calculate bounding box from array of coordinates
 */
function calculateBounds(pois: { lat: number; lng: number }[]) {
  let north = -Infinity;
  let south = Infinity;
  let east = -Infinity;
  let west = Infinity;

  for (const poi of pois) {
    if (poi.lat > north) north = poi.lat;
    if (poi.lat < south) south = poi.lat;
    if (poi.lng > east) east = poi.lng;
    if (poi.lng < west) west = poi.lng;
  }

  return { north, south, east, west };
}

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
 * Update race name and description
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
