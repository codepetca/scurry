// Centralized z-index scale for consistent layering
// Use these constants instead of hardcoded z-index values

export const Z_INDEX = {
  // Base layer (map controls, progress bars)
  MAP_CONTROLS: 10,

  // Overlays (modals, carousels)
  MODAL_BACKDROP: 50,
  MODAL_CONTENT: 51,

  // Alerts and notifications
  TOAST: 60,
} as const;
