// The gravity well at lock: grid points are pulled toward the station centre with a Gaussian falloff.
// Station units (viewBox -320..320). Mirrored in warp.wgsl, keep the constants in sync.
export const WARP_PULL = 0.42; // fraction of the distance pulled in at the centre, at amount = 1
export const WARP_SIGMA = 170; // falloff radius

export function warpPoint(x: number, y: number, amount: number): [number, number] {
  if (amount <= 0) return [x, y];
  const r2 = x * x + y * y;
  const f = WARP_PULL * amount * Math.exp(-r2 / (WARP_SIGMA * WARP_SIGMA));
  return [x * (1 - f), y * (1 - f)];
}
