import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  races: defineTable({
    name: v.string(),
    description: v.string(),
    bounds: v.object({
      north: v.number(),
      south: v.number(),
      east: v.number(),
      west: v.number(),
    }),
  }),

  pois: defineTable({
    raceId: v.id("races"),
    order: v.number(),
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
    validationConfig: v.optional(
      v.object({
        radiusMeters: v.optional(v.number()),
        qrValue: v.optional(v.string()),
      })
    ),
  }).index("by_race", ["raceId"]),

  completions: defineTable({
    visitorId: v.string(),
    poiId: v.id("pois"),
    photoId: v.id("_storage"),
    completedAt: v.number(),
    // Multiplayer fields (optional for backwards compatibility)
    gameId: v.optional(v.id("games")),
    teamIndex: v.optional(v.number()),
  })
    .index("by_visitor", ["visitorId"])
    .index("by_poi", ["poiId"])
    .index("by_game", ["gameId"]),

  // Multiplayer games
  games: defineTable({
    code: v.string(),
    raceId: v.id("races"),
    hostId: v.string(),
    mode: v.union(v.literal("collaborative"), v.literal("competitive")),
    status: v.union(v.literal("lobby"), v.literal("active"), v.literal("ended")),
    teamNames: v.array(v.string()),
    timeLimit: v.optional(v.number()), // minutes
    startedAt: v.optional(v.number()),
    endedAt: v.optional(v.number()),
    expiresAt: v.number(), // auto-delete after 72 hours
  })
    .index("by_code", ["code"])
    .index("by_host", ["hostId"]),

  // Players in a game
  players: defineTable({
    gameId: v.id("games"),
    visitorId: v.string(),
    displayName: v.string(),
    teamIndex: v.number(),
    joinedAt: v.number(),
    isHost: v.boolean(),
    kicked: v.boolean(),
  })
    .index("by_game", ["gameId"])
    .index("by_visitor", ["visitorId"])
    .index("by_game_visitor", ["gameId", "visitorId"]),
});
