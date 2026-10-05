// Safety limits, not visible workspace/camera bounds. Negative space is valid.
export const PROJECT_CANVAS_LIMITS = {
  coordinate: 1_000_000,
  dimension: 20_000,
  zIndex: 1_000_000,
  boundaryPairs: 65_536,
  searchCandidates: 4_096,
  collisionChecks: 2_000_000,
} as const;
