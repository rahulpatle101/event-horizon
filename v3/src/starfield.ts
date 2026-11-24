// Starfield (ART_DIRECTION §7.5): Canvas 2D, three layers, sparse. Sizes 0.5 / 1 / 1.5 px; 90% starlight at
// 40–90% opacity, 10% faint warm/cool tints. Parallax ±4 / ±8 / ±14 px per layer; ≤5% of stars twinkle.

export interface Star {
  x: number; // 0..1
  y: number; // 0..1
  layer: 0 | 1 | 2;
  alpha: number;
  tint: string;
  /** Twinkle phase, or -1 for a steady star (≤5% twinkle, §7.5). */
  twinkle: number;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeStars(count: number, tokens: { hi: string; warm: string; cool: string }): Star[] {
  const random = mulberry32(264);
  return Array.from({ length: count }, () => {
    const r = random();
    const layer: 0 | 1 | 2 = r < 0.6 ? 0 : r < 0.9 ? 1 : 2;
    const t = random();
    return {
      x: random(),
      y: random(),
      layer,
      alpha: 0.4 + random() * 0.5,
      tint: t < 0.05 ? tokens.warm : t < 0.1 ? tokens.cool : tokens.hi,
      twinkle: random() < 0.04 ? random() * Math.PI * 2 : -1,
    };
  });
}

const SIZES = [0.5, 1, 1.5] as const;

export interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Draw the field. Stars inside `avoid` rects (text areas, the console) are skipped so copy stays clean. */
export function drawStars(
  canvas: HTMLCanvasElement,
  stars: Star[],
  avoid: Rect[] = [],
  offset: [number, number][] = [[0, 0], [0, 0], [0, 0]],
  time = 0,
): void {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  for (const s of stars) {
    const [ox, oy] = offset[s.layer]!;
    const x = s.x * w + ox;
    const y = s.y * h + oy;
    if (avoid.some((r) => x > r.x0 && x < r.x1 && y > r.y0 && y < r.y1)) continue;
    const size = SIZES[s.layer];
    // Twinkle: a slow, shallow breath (never a flicker), on the few stars that have one.
    ctx.globalAlpha = s.twinkle < 0 ? s.alpha : s.alpha * (0.7 + 0.3 * Math.sin(time * 0.9 + s.twinkle));
    ctx.fillStyle = s.tint;
    ctx.beginPath();
    ctx.arc(x, y, size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}
