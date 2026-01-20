import { mutation, query, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

// Generate a random 6-character code
function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // No I, O, 0, 1 for clarity
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Create a new game
export const create = mutation({
  args: {
    raceId: v.id("races"),
    hostId: v.string(),
    mode: v.union(v.literal("collaborative"), v.literal("competitive")),
    teamNames: v.array(v.string()),
    timeLimit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Generate unique code
    let code = generateCode();
    let existing = await ctx.db
      .query("games")
      .withIndex("by_code", (q) => q.eq("code", code))
      .first();

    // Retry if code exists
    while (existing) {
      code = generateCode();
      existing = await ctx.db
        .query("games")
        .withIndex("by_code", (q) => q.eq("code", code))
        .first();
    }

    // Create game (expires in 72 hours)
    const expiresAt = Date.now() + 72 * 60 * 60 * 1000;

    const gameId = await ctx.db.insert("games", {
      code,
      raceId: args.raceId,
      hostId: args.hostId,
      mode: args.mode,
      status: "lobby",
      teamNames: args.teamNames,
      timeLimit: args.timeLimit,
      expiresAt,
    });

    // Add host as first player
    await ctx.db.insert("players", {
      gameId,
      visitorId: args.hostId,
      displayName: "Host",
      teamIndex: 0,
      joinedAt: Date.now(),
      isHost: true,
      kicked: false,
    });

    return { gameId, code };
  },
});

// Join an existing game
export const join = mutation({
  args: {
    code: v.string(),
    visitorId: v.string(),
    displayName: v.string(),
    teamIndex: v.number(),
  },
  handler: async (ctx, args) => {
    // Find game by code
    const game = await ctx.db
      .query("games")
      .withIndex("by_code", (q) => q.eq("code", args.code.toUpperCase()))
      .first();

    if (!game) {
      throw new Error("Game not found");
    }

    if (game.status !== "lobby") {
      throw new Error("Game has already started");
    }

    if (game.expiresAt < Date.now()) {
      throw new Error("Game has expired");
    }

    // Check if player already in game
    const existingPlayer = await ctx.db
      .query("players")
      .withIndex("by_game_visitor", (q) =>
        q.eq("gameId", game._id).eq("visitorId", args.visitorId)
      )
      .first();

    if (existingPlayer) {
      if (existingPlayer.kicked) {
        throw new Error("You have been kicked from this game");
      }
      // Update display name and team if rejoining
      await ctx.db.patch(existingPlayer._id, {
        displayName: args.displayName,
        teamIndex: args.teamIndex,
      });
      return { gameId: game._id, playerId: existingPlayer._id };
    }

    // Check team capacity (max 10 per team)
    const teamPlayers = await ctx.db
      .query("players")
      .withIndex("by_game", (q) => q.eq("gameId", game._id))
      .filter((q) => q.eq(q.field("teamIndex"), args.teamIndex))
      .filter((q) => q.eq(q.field("kicked"), false))
      .collect();

    if (teamPlayers.length >= 10) {
      throw new Error("Team is full (max 10 players)");
    }

    // Add player
    const playerId = await ctx.db.insert("players", {
      gameId: game._id,
      visitorId: args.visitorId,
      displayName: args.displayName,
      teamIndex: args.teamIndex,
      joinedAt: Date.now(),
      isHost: false,
      kicked: false,
    });

    return { gameId: game._id, playerId };
  },
});

// Start the game (host only)
export const start = mutation({
  args: {
    gameId: v.id("games"),
    hostId: v.string(),
  },
  handler: async (ctx, args) => {
    const game = await ctx.db.get(args.gameId);

    if (!game) {
      throw new Error("Game not found");
    }

    if (game.hostId !== args.hostId) {
      throw new Error("Only the host can start the game");
    }

    if (game.status !== "lobby") {
      throw new Error("Game has already started");
    }

    const startedAt = Date.now();

    await ctx.db.patch(args.gameId, {
      status: "active",
      startedAt,
    });

    // Schedule time limit expiry if set
    if (game.timeLimit) {
      const expiryTime = startedAt + game.timeLimit * 60 * 1000;
      await ctx.scheduler.runAt(expiryTime, internal.games.endByTimeLimit, {
        gameId: args.gameId,
      });
    }

    return { success: true };
  },
});

// End the game (host only)
export const end = mutation({
  args: {
    gameId: v.id("games"),
    hostId: v.string(),
  },
  handler: async (ctx, args) => {
    const game = await ctx.db.get(args.gameId);

    if (!game) {
      throw new Error("Game not found");
    }

    if (game.hostId !== args.hostId) {
      throw new Error("Only the host can end the game");
    }

    await ctx.db.patch(args.gameId, {
      status: "ended",
      endedAt: Date.now(),
    });

    return { success: true };
  },
});

// Kick a player (host only)
export const kick = mutation({
  args: {
    gameId: v.id("games"),
    hostId: v.string(),
    playerId: v.id("players"),
  },
  handler: async (ctx, args) => {
    const game = await ctx.db.get(args.gameId);

    if (!game) {
      throw new Error("Game not found");
    }

    if (game.hostId !== args.hostId) {
      throw new Error("Only the host can kick players");
    }

    const player = await ctx.db.get(args.playerId);

    if (!player || player.gameId !== args.gameId) {
      throw new Error("Player not found in this game");
    }

    if (player.isHost) {
      throw new Error("Cannot kick the host");
    }

    await ctx.db.patch(args.playerId, {
      kicked: true,
    });

    return { success: true };
  },
});

// Update host display name
export const updateHostName = mutation({
  args: {
    gameId: v.id("games"),
    hostId: v.string(),
    displayName: v.string(),
  },
  handler: async (ctx, args) => {
    const player = await ctx.db
      .query("players")
      .withIndex("by_game_visitor", (q) =>
        q.eq("gameId", args.gameId).eq("visitorId", args.hostId)
      )
      .first();

    if (!player) {
      throw new Error("Player not found");
    }

    await ctx.db.patch(player._id, {
      displayName: args.displayName,
    });

    return { success: true };
  },
});

// Get game by code
export const getByCode = query({
  args: { code: v.string() },
  handler: async (ctx, args) => {
    const game = await ctx.db
      .query("games")
      .withIndex("by_code", (q) => q.eq("code", args.code.toUpperCase()))
      .first();

    if (!game) return null;

    // Get race info
    const race = await ctx.db.get(game.raceId);

    return { ...game, race };
  },
});

// Get game by ID
export const getById = query({
  args: { gameId: v.id("games") },
  handler: async (ctx, args) => {
    const game = await ctx.db.get(args.gameId);
    if (!game) return null;

    const race = await ctx.db.get(game.raceId);
    return { ...game, race };
  },
});

// List players in a game
export const listPlayers = query({
  args: { gameId: v.id("games") },
  handler: async (ctx, args) => {
    const players = await ctx.db
      .query("players")
      .withIndex("by_game", (q) => q.eq("gameId", args.gameId))
      .filter((q) => q.eq(q.field("kicked"), false))
      .collect();

    return players;
  },
});

// Get player by visitor ID in a game
export const getPlayer = query({
  args: {
    gameId: v.id("games"),
    visitorId: v.string(),
  },
  handler: async (ctx, args) => {
    const player = await ctx.db
      .query("players")
      .withIndex("by_game_visitor", (q) =>
        q.eq("gameId", args.gameId).eq("visitorId", args.visitorId)
      )
      .first();

    return player;
  },
});

// End game when time limit expires (internal, called by scheduler)
export const endByTimeLimit = internalMutation({
  args: {
    gameId: v.id("games"),
  },
  handler: async (ctx, args) => {
    const game = await ctx.db.get(args.gameId);

    // Only end if still active
    if (game && game.status === "active") {
      await ctx.db.patch(args.gameId, {
        status: "ended",
        endedAt: Date.now(),
      });
      return { ended: true };
    }

    return { ended: false };
  },
});

// Cleanup expired games (internal, called by cron)
export const cleanupExpired = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    // Find expired games
    const expiredGames = await ctx.db
      .query("games")
      .filter((q) => q.lt(q.field("expiresAt"), now))
      .collect();

    for (const game of expiredGames) {
      // Delete all players in this game
      const players = await ctx.db
        .query("players")
        .withIndex("by_game", (q) => q.eq("gameId", game._id))
        .collect();

      for (const player of players) {
        await ctx.db.delete(player._id);
      }

      // Delete completions for this game
      const completions = await ctx.db
        .query("completions")
        .withIndex("by_game", (q) => q.eq("gameId", game._id))
        .collect();

      for (const completion of completions) {
        await ctx.db.delete(completion._id);
      }

      // Delete the game
      await ctx.db.delete(game._id);
    }

    return { deleted: expiredGames.length };
  },
});
