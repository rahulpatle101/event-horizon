// Tunable feel for the particle system. Defaults are the starting point; ?tune overrides them live.

export interface ParticleFeel {
  /** Spring stiffness toward each particle's target (1/s²). */
  stiffness: number;
  /** Spring damping (1/s). ζ = damping / (2·√stiffness); ~0.8 gives a slight overshoot. */
  damping: number;
  /** Pointer repel radius (CSS px) and peak acceleration (px/s²). */
  repelRadius: number;
  repelStrength: number;
  /** Hover pull toward the Send button: radius (CSS px) and peak acceleration (px/s²). */
  pullRadius: number;
  pullStrength: number;
  /** Particles on desktop; phones use a quarter of this (about 2k at the default). */
  count: number;
  /** Sprite size multiplier and bloom intensity. */
  size: number;
  glow: number;
}

export const DEFAULT_FEEL: ParticleFeel = {
  stiffness: 14,
  damping: 6,
  repelRadius: 110,
  repelStrength: 2600,
  pullRadius: 240,
  pullStrength: 900,
  count: 9000,
  size: 1,
  glow: 0.75,
};

/** Share of particles that form the patch; the rest stay in the sky. */
export const PATCH_SHARE = 0.72;
export const MOBILE_COUNT_SCALE = 0.22;
export const MAX_SPEED = 1800; // px/s, keeps long flights from overshooting wildly
