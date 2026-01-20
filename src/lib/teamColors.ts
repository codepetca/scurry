// Team colors for multiplayer games
// Colors are chosen to be distinguishable and accessible

export const TEAM_COLORS = [
  { name: "Green", bg: "#22c55e", ring: "#16a34a", text: "#166534" },
  { name: "Blue", bg: "#3b82f6", ring: "#2563eb", text: "#1d4ed8" },
  { name: "Orange", bg: "#f97316", ring: "#ea580c", text: "#c2410c" },
  { name: "Purple", bg: "#a855f7", ring: "#9333ea", text: "#7e22ce" },
  { name: "Pink", bg: "#ec4899", ring: "#db2777", text: "#be185d" },
];

export function getTeamColor(teamIndex: number) {
  return TEAM_COLORS[teamIndex % TEAM_COLORS.length];
}
