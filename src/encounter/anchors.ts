// Screen positions for the scan annotations, derived from the same camera framing the
// shader uses (see cameraRay in geodesic.wgsl): screen = R(roll) · screenPlane, and the
// ray direction scales with 1 / fov. Anchors were measured once in a reference framing
// and are re-projected for any other framing, viewport, or cover-fitted poster.
import { FRAMINGS, type Framing } from "../blackhole/settings.ts";

export type AnchorId = "shadow" | "ring" | "disk";

/** Reference framing in which the anchor points below were measured (1440×900 render). */
const REFERENCE = { fov: 2.3, roll: -0.16 };

/** Screen-plane points (units of half the viewport height, y up) in the reference framing. */
const MEASURED: Record<AnchorId, readonly [number, number]> = {
  shadow: [0.09, 0.11], // inside the shadow, clear of the lensed arc
  ring: [-0.327, 0.324], // on the thin photon ring, upper left
  disk: [-0.93, -0.244], // on the near side of the disk's left wing
};

const rotate = ([x, y]: readonly [number, number], a: number): [number, number] => [
  x * Math.cos(a) - y * Math.sin(a),
  x * Math.sin(a) + y * Math.cos(a),
];

/** Screen-plane coordinates of an anchor in a given framing. */
function screenPlane(id: AnchorId, framing: Framing): [number, number] {
  const ray = rotate(MEASURED[id], REFERENCE.roll);
  const scene: [number, number] = [ray[0] / REFERENCE.fov, ray[1] / REFERENCE.fov];
  return rotate([scene[0] * framing.fov, scene[1] * framing.fov], -framing.cameraRoll);
}

/** Pixel position inside a W×H image rendered with `framing`. */
function inImage(id: AnchorId, framing: Framing, w: number, h: number): [number, number] {
  const [px, py] = screenPlane(id, framing);
  return [(w / 2) * (1 + framing.centerX) + px * (h / 2), (h / 2) * (1 - framing.centerY) - py * (h / 2)];
}

export interface Viewport {
  width: number;
  height: number;
  /** When set, the scene is a cover-fitted poster of this size aligned on the shadow centre. */
  poster?: { width: number; height: number };
}

export function anchorPositions(framingName: keyof typeof FRAMINGS, view: Viewport) {
  const framing = FRAMINGS[framingName];
  const ids: AnchorId[] = ["shadow", "ring", "disk"];
  const result = {} as Record<AnchorId, { x: number; y: number }>;
  for (const id of ids) {
    if (!view.poster) {
      const [x, y] = inImage(id, framing, view.width, view.height);
      result[id] = { x, y };
      continue;
    }
    // object-fit: cover with object-position at the shadow centre (see styles.css).
    const { width: pw, height: ph } = view.poster;
    const scale = Math.max(view.width / pw, view.height / ph);
    const fx = (1 + framing.centerX) / 2;
    const fy = (1 - framing.centerY) / 2;
    const ox = (view.width - pw * scale) * fx;
    const oy = (view.height - ph * scale) * fy;
    const [ix, iy] = inImage(id, framing, pw, ph);
    result[id] = { x: ox + ix * scale, y: oy + iy * scale };
  }
  return result;
}
