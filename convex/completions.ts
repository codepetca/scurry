import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const listByVisitor = query({
  args: { visitorId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("completions")
      .withIndex("by_visitor", (q) => q.eq("visitorId", args.visitorId))
      .collect();
  },
});

// Solo mode completion
export const create = mutation({
  args: {
    visitorId: v.string(),
    poiId: v.id("pois"),
    photoId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    // Check if already completed
    const existing = await ctx.db
      .query("completions")
      .withIndex("by_visitor", (q) => q.eq("visitorId", args.visitorId))
      .filter((q) => q.eq(q.field("poiId"), args.poiId))
      .first();

    if (existing) {
      return existing._id;
    }

    return await ctx.db.insert("completions", {
      visitorId: args.visitorId,
      poiId: args.poiId,
      photoId: args.photoId,
      completedAt: Date.now(),
    });
  },
});

// Multiplayer completion
export const createForGame = mutation({
  args: {
    gameId: v.id("games"),
    visitorId: v.string(),
    poiId: v.id("pois"),
    photoId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    // Get game and validate it's active
    const game = await ctx.db.get(args.gameId);
    if (!game) {
      throw new Error("Game not found");
    }
    if (game.status !== "active") {
      throw new Error("Game is not active");
    }

    // Get player to find their team
    const player = await ctx.db
      .query("players")
      .withIndex("by_game_visitor", (q) =>
        q.eq("gameId", args.gameId).eq("visitorId", args.visitorId)
      )
      .first();

    if (!player) {
      throw new Error("Player not found in game");
    }
    if (player.kicked) {
      throw new Error("You have been kicked from this game");
    }

    // Check if this player already completed this POI
    const existingByPlayer = await ctx.db
      .query("completions")
      .withIndex("by_game", (q) => q.eq("gameId", args.gameId))
      .filter((q) =>
        q.and(
          q.eq(q.field("visitorId"), args.visitorId),
          q.eq(q.field("poiId"), args.poiId)
        )
      )
      .first();

    if (existingByPlayer) {
      return { completionId: existingByPlayer._id, isNew: false };
    }

    // Create completion
    const completionId = await ctx.db.insert("completions", {
      visitorId: args.visitorId,
      poiId: args.poiId,
      photoId: args.photoId,
      completedAt: Date.now(),
      gameId: args.gameId,
      teamIndex: player.teamIndex,
    });

    return { completionId, isNew: true };
  },
});

// Get all completions for a game (real-time updates)
export const listByGame = query({
  args: { gameId: v.id("games") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("completions")
      .withIndex("by_game", (q) => q.eq("gameId", args.gameId))
      .collect();
  },
});

// Get completions grouped by team for a game
export const listByGameGroupedByTeam = query({
  args: { gameId: v.id("games") },
  handler: async (ctx, args) => {
    const completions = await ctx.db
      .query("completions")
      .withIndex("by_game", (q) => q.eq("gameId", args.gameId))
      .collect();

    // Group by team, counting unique POIs per team
    const teamCompletions: Record<number, Set<string>> = {};

    for (const completion of completions) {
      const teamIndex = completion.teamIndex ?? 0;
      if (!teamCompletions[teamIndex]) {
        teamCompletions[teamIndex] = new Set();
      }
      teamCompletions[teamIndex].add(completion.poiId);
    }

    // Convert to counts
    const result: Record<number, number> = {};
    for (const [teamIndex, poiSet] of Object.entries(teamCompletions)) {
      result[Number(teamIndex)] = poiSet.size;
    }

    return result;
  },
});

// Get all completions for a specific POI in a game (for photo carousel)
export const listByGameAndPoi = query({
  args: {
    gameId: v.id("games"),
    poiId: v.id("pois"),
  },
  handler: async (ctx, args) => {
    const completions = await ctx.db
      .query("completions")
      .withIndex("by_game", (q) => q.eq("gameId", args.gameId))
      .filter((q) => q.eq(q.field("poiId"), args.poiId))
      .collect();

    // Fetch all players for this game once (avoids N+1 queries)
    const players = await ctx.db
      .query("players")
      .withIndex("by_game", (q) => q.eq("gameId", args.gameId))
      .collect();

    // Build lookup map
    const playerMap = new Map(
      players.map((p) => [p.visitorId, p.displayName])
    );

    // Add player names to completions
    const completionsWithPlayers = completions.map((completion) => ({
      ...completion,
      playerName: playerMap.get(completion.visitorId) ?? "Unknown",
    }));

    return completionsWithPlayers;
  },
});

export const clearByVisitor = mutation({
  args: { visitorId: v.string() },
  handler: async (ctx, args) => {
    const completions = await ctx.db
      .query("completions")
      .withIndex("by_visitor", (q) => q.eq("visitorId", args.visitorId))
      .collect();

    for (const completion of completions) {
      await ctx.db.delete(completion._id);
    }

    return completions.length;
  },
});
