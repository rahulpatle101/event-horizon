// Particle data: fixed per-particle attributes, the simulated state, and the swappable target buffer.
import type { Gpu, StorageBuffer } from "vgpu";
import { storage } from "vgpu";

export interface ParticleBuffers {
  count: number;
  state: StorageBuffer; // vec4 per particle: position.xy, velocity.xy (CSS px, px/s)
  attrs: StorageBuffer; // 2 × vec4 per particle (see params.wgsl)
  targets: StorageBuffer; // vec4 per particle: x, y, hasTarget, 0
  /** CPU copy of homes (0..1), used to pair particles with target points. */
  homes: Float32Array;
}

/** Release a GPU buffer if the runtime exposes destroy() (not part of the public StorageBuffer type). */
export function release(resource: unknown): void {
  (resource as { destroy?: () => void } | undefined)?.destroy?.();
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

export interface HomeRules {
  width: number;
  height: number;
  /** Reject homes inside this circle (the planet), in CSS px. */
  avoid?: { cx: number; cy: number; r: number };
}

export function createParticles(gpu: Gpu, count: number, rules: HomeRules): ParticleBuffers {
  const random = mulberry32(2028);
  const attrs = new Float32Array(count * 8);
  const homes = new Float32Array(count * 2);
  const state = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    let hx = 0;
    let hy = 0;
    for (let tries = 0; tries < 12; tries++) {
      hx = random();
      hy = random();
      const a = rules.avoid;
      if (!a) break;
      const dx = hx * rules.width - a.cx;
      const dy = hy * rules.height - a.cy;
      if (dx * dx + dy * dy > (a.r + 8) * (a.r + 8)) break;
    }
    const roll = random();
    // Mostly faint dust, some medium stars, a few bright "hero" stars with soft rays.
    const [size, brightness] =
      roll < 0.7 ? [0.7 + random() * 0.6, 0.35 + random() * 0.35]
      : roll < 0.95 ? [1.3 + random() * 0.7, 0.7 + random() * 0.4]
      : [2.2 + random() * 0.8, 1.4 + random() * 0.5];
    const tint = random() < 0.12 ? 0.5 + random() * 0.5 : random() * 0.15;
    attrs.set([hx, hy, random(), size, brightness, tint, random() * 0.45, 0.75 + random() * 0.5], i * 8);
    homes[i * 2] = hx;
    homes[i * 2 + 1] = hy;
    state.set([hx * rules.width, hy * rules.height, 0, 0], i * 4);
  }

  const created: StorageBuffer[] = [];
  try {
    const stateBuffer = storage(gpu, state.byteLength, "read-write");
    created.push(stateBuffer);
    stateBuffer.write(state);
    const attrsBuffer = storage(gpu, attrs.byteLength, "read");
    created.push(attrsBuffer);
    attrsBuffer.write(attrs);
    const targetsBuffer = storage(gpu, count * 16, "read");
    created.push(targetsBuffer);
    targetsBuffer.write(new Float32Array(count * 4));
    return { count, state: stateBuffer, attrs: attrsBuffer, targets: targetsBuffer, homes };
  } catch (error) {
    for (const b of created) release(b);
    throw error;
  }
}

export function destroyParticles(p: ParticleBuffers): void {
  release(p.state);
  release(p.attrs);
  release(p.targets);
}

/**
 * Point the first `points.length / 2` particles at a shape (CSS px); the rest return to the sky.
 * Particles and points are paired by angle around `center` so stars travel roughly straight in
 * instead of crossing each other.
 */
export function writeTargets(
  p: ParticleBuffers,
  points: Float32Array,
  center: [number, number],
  viewport: [number, number],
): void {
  const n = Math.min(p.count, points.length / 2);
  const angle = (x: number, y: number) => Math.atan2(y - center[1], x - center[0]);
  const particleOrder = Array.from({ length: n }, (_, i) => i).sort(
    (a, b) =>
      angle(p.homes[a * 2]! * viewport[0], p.homes[a * 2 + 1]! * viewport[1]) -
      angle(p.homes[b * 2]! * viewport[0], p.homes[b * 2 + 1]! * viewport[1]),
  );
  const pointOrder = Array.from({ length: n }, (_, i) => i).sort(
    (a, b) => angle(points[a * 2]!, points[a * 2 + 1]!) - angle(points[b * 2]!, points[b * 2 + 1]!),
  );
  const data = new Float32Array(p.count * 4);
  for (let k = 0; k < n; k++) {
    const i = particleOrder[k]!;
    const j = pointOrder[k]!;
    data.set([points[j * 2]!, points[j * 2 + 1]!, 1, 0], i * 4);
  }
  p.targets.write(data);
}
