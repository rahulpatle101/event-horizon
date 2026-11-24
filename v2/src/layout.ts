// Scene geometry in CSS pixels, shared by the static poster and (later) the GPU layer,
// so the planet, the transfer arc and the pin line up in both. Mirrors the CSS in styles.css.

export interface SceneGeometry {
  planet: { cx: number; cy: number; r: number };
  /** Where the particle patch forms: centre and diameter in CSS px. */
  patch: { cx: number; cy: number; size: number };
  /** Cubic Bézier from off-screen Earth (bottom-left) to the landing point on Mars. */
  arc: { p0: [number, number]; c1: [number, number]; c2: [number, number]; p3: [number, number] };
}

export const MOBILE_QUERY = "(max-width: 767px)";

export function sceneGeometry(width: number, height: number, mobile: boolean): SceneGeometry {
  // Desktop: Mars ≈ 120% of viewport height, low right, only the upper limb showing.
  // Mobile: Mars crops to the bottom of the screen.
  const r = 0.6 * height;
  const cx = (mobile ? 0.62 : 0.72) * width;
  const cy = (mobile ? 0.6 : 0.52) * height + r;
  // Landing point sits just inside the lit upper limb.
  const land: [number, number] = mobile ? [cx - 0.25 * r, cy - 0.95 * r] : [cx - 0.38 * r, cy - 0.85 * r];
  // Patch: in the empty void between the headline and Mars (desktop); above the limb on phones.
  const patch = mobile
    ? { cx: 0.5 * width, cy: 0.79 * height, size: Math.min(0.62 * width, 0.26 * height) }
    : { cx: 0.6 * width, cy: 0.335 * height, size: Math.min(0.3 * height, 0.23 * width) };
  return {
    planet: { cx, cy, r },
    patch,
    arc: mobile
      ? // Phones: Mars fills the bottom, so the arc skims in from the left just above the limb.
        { p0: [-0.06 * width, 0.585 * height], c1: [0.1 * width, 0.585 * height], c2: [0.22 * width, 0.6 * height], p3: land }
      : { p0: [-0.04 * width, 1.06 * height], c1: [0.18 * width, 0.98 * height], c2: [0.42 * width, 0.64 * height], p3: land },
  };
}
