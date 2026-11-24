// Tessaly Ring as a hairline SVG instrument (ART_DIRECTION §7.4): a fixed bezel (tick ring, 0° index)
// and a rotating station body (hull, inner ring + spokes, hub, PORT 04). Shading is line density,
// never gradients. Offset 0° = PORT 04 at the top, under the crosshair.
// Boot "line draw" uses per-layer sector masks that sweep 0→360° (outer first), which keeps 1px
// non-scaling hairlines exact at any size (dash-offset tricks don't survive non-scaling strokes).

import { warpPoint } from "./warp/field.ts";

const NS = "http://www.w3.org/2000/svg";
const R_HULL = 210;
const R_BEZEL = 246;
const R_ARROW = 232;
const GRID_STEP = 40;

type Attrs = Record<string, string | number>;
export type DrawLayer = "bezel" | "hull" | "inner" | "hub";

function el<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Attrs = {}, parent?: Element): SVGElementTagNameMap[K] {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  parent?.append(node);
  return node;
}

/** Point on a circle; angle in degrees clockwise from 12 o'clock. */
function polar(r: number, deg: number): [number, number] {
  const a = ((deg - 90) * Math.PI) / 180;
  return [r * Math.cos(a), r * Math.sin(a)];
}

function arcPath(r: number, from: number, to: number): string {
  const [x0, y0] = polar(r, from);
  const [x1, y1] = polar(r, to);
  const sweep = to > from ? 1 : 0;
  const large = Math.abs(to - from) > 180 ? 1 : 0;
  return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 ${large} ${sweep} ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}

/** Filled wedge from 0° clockwise to `deg` (mask shape for the line-draw sweep). */
function wedge(deg: number): string {
  if (deg >= 359.9) return "M -400 -400 H 400 V 400 H -400 Z";
  if (deg <= 0) return "M 0 0 Z";
  const R = 400;
  const [x1, y1] = polar(R, deg);
  return `M 0 0 L 0 ${-R} A ${R} ${R} 0 ${deg > 180 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)} Z`;
}

export interface Station {
  /** Rotate the station so PORT 04 sits `offset` degrees clockwise of the index. */
  setOffset(offset: number): void;
  setLocked(locked: boolean): void;
  /** Line-draw progress per layer, 0..1 (boot). */
  setDraw(progress: Record<DrawLayer, number>): void;
  /** Highlight the bezel tick nearest to a pointer angle (degrees), or none. */
  setHoverTick(angle: number | undefined): void;
  /** Light the tick under the crosshair while inside tolerance. */
  setAligned(aligned: boolean): void;
  /** Fallback (no WebGPU): bend the SVG grid by the warp field, amount 0..1. */
  setGridWarp(amount: number): void;
  /** Keep SVG text at a fixed CSS pixel size whatever the instrument's rendered scale. */
  setRenderedSize(px: number): void;
  readonly root: SVGSVGElement;
}

export function buildStation(svg: SVGSVGElement): Station {
  svg.replaceChildren();
  svg.setAttribute("viewBox", "-320 -320 640 640");

  const defs = el("defs", {}, svg);
  // ---- grid fade mask
  const grad = el("radialGradient", { id: "grid-fade" }, defs);
  el("stop", { offset: "0.35", "stop-color": "#fff", "stop-opacity": 1 }, grad);
  el("stop", { offset: "1", "stop-color": "#fff", "stop-opacity": 0 }, grad);
  const gridMask = el("mask", { id: "grid-mask" }, defs);
  el("rect", { x: -320, y: -320, width: 640, height: 640, fill: "url(#grid-fade)" }, gridMask);

  // ---- line-draw masks, one per layer
  const drawMasks = {} as Record<DrawLayer, SVGPathElement>;
  for (const layer of ["bezel", "hull", "inner", "hub"] as DrawLayer[]) {
    const m = el("mask", { id: `draw-${layer}`, maskUnits: "userSpaceOnUse", x: -400, y: -400, width: 800, height: 800 }, defs);
    drawMasks[layer] = el("path", { d: wedge(360), fill: "#fff" }, m);
  }

  // ---- grid (warps at lock), masked to fade into the void
  const grid = el("g", { class: "grid", mask: "url(#grid-mask)" }, svg);
  const gridLines: { horizontal: boolean; v: number; node: SVGPolylineElement }[] = [];
  for (let v = -320; v <= 320; v += GRID_STEP) {
    for (const horizontal of [false, true]) {
      gridLines.push({ horizontal, v, node: el("polyline", {}, grid) });
    }
  }

  // ---- fixed bezel: tick ring every 5° / 15°, labels every 45°, 0° index caret
  const bezel = el("g", { class: "bezel", mask: "url(#draw-bezel)" }, svg);
  el("circle", { r: R_BEZEL, class: "lo" }, bezel);
  const ticks = new Map<number, SVGLineElement>();
  for (let d = 0; d < 360; d += 5) {
    const major = d % 15 === 0;
    const [x0, y0] = polar(R_BEZEL, d);
    const [x1, y1] = polar(R_BEZEL + (major ? 12 : 6), d);
    ticks.set(d, el("line", { x1: x0, y1: y0, x2: x1, y2: y1, class: major ? "mid" : "lo" }, bezel));
  }
  const labels = el("g", { class: "bezel__labels fade-in" }, svg);
  for (let d = 45; d < 360; d += 45) {
    const [x, y] = polar(R_BEZEL + 26, d);
    const t = el("text", { x, y, "text-anchor": "middle", "dominant-baseline": "middle" }, labels);
    t.textContent = String(d).padStart(3, "0");
  }
  el("path", { d: `M -7 ${-R_BEZEL - 22} L 7 ${-R_BEZEL - 22} L 0 ${-R_BEZEL - 10} Z`, class: "index fade-in" }, svg);

  // ---- rotating station body (sub-groups so the boot can draw outer → inner)
  const ring = el("g", { class: "ring" }, svg);
  const hull = el("g", { mask: "url(#draw-hull)" }, ring);
  el("circle", { r: R_HULL, class: "hi" }, hull);
  for (const r of [206, 202.5, 199.5]) el("circle", { r, class: "lo" }, hull);
  el("circle", { r: 196, class: "mid" }, hull);
  for (let d = 7.5; d < 360; d += 15) {
    const [x0, y0] = polar(196, d);
    const [x1, y1] = polar(R_HULL, d);
    el("line", { x1: x0, y1: y0, x2: x1, y2: y1, class: "mid" }, hull);
  }
  const inner = el("g", { mask: "url(#draw-inner)" }, ring);
  el("circle", { r: 120, class: "mid" }, inner);
  el("circle", { r: 112, class: "lo" }, inner);
  for (let d = 22.5; d < 360; d += 45) {
    const [x0, y0] = polar(112, d);
    const [x1, y1] = polar(120, d);
    el("line", { x1: x0, y1: y0, x2: x1, y2: y1, class: "mid" }, inner);
  }
  for (const d of [45, 135, 225, 315]) {
    for (const side of [-5, 5]) {
      const a = ((d - 90) * Math.PI) / 180;
      const nx = -Math.sin(a) * side;
      const ny = Math.cos(a) * side;
      const [x0, y0] = polar(40, d);
      const [x1, y1] = polar(196, d);
      el("line", { x1: x0 + nx, y1: y0 + ny, x2: x1 + nx, y2: y1 + ny, class: "mid" }, inner);
    }
  }
  const hub = el("g", { mask: "url(#draw-hub)" }, ring);
  el("circle", { r: 40, class: "hi" }, hub);
  el("circle", { r: 26, class: "mid" }, hub);
  el("circle", { r: 3, class: "dot" }, hub);
  const port = el("g", { class: "port fade-in" }, ring);
  el("rect", { x: -13, y: -R_HULL - 16, width: 26, height: 16, class: "hi" }, port);
  el("line", { x1: -13, y1: -R_HULL - 8, x2: 13, y2: -R_HULL - 8, class: "lo" }, port);
  const portLight = el("circle", { cx: 0, cy: -R_HULL - 8, r: 3.2, class: "port__light" }, port);
  const portLabel = el("text", {
    x: 0, y: -R_HULL + 32, "text-anchor": "middle", "dominant-baseline": "middle", class: "port__label",
  }, port);
  portLabel.textContent = "04";

  // ---- feedback (fixed frame): offset arrow along the bezel, affordance label + leader
  const arrow = el("g", { class: "arrow" }, svg);
  const arrowPath = el("path", { class: "arrow__arc" }, arrow);
  const arrowHead = el("path", { class: "arrow__head" }, arrow);
  const afford = el("g", { class: "afford" }, svg);
  const leader = el("polyline", { class: "afford__leader" }, afford);
  const affordText = el("text", { class: "afford__text" }, afford);
  affordText.textContent = "04-11 · DRAG TO ALIGN";

  const cross = el("g", { class: "cross" }, svg);
  el("line", { x1: -10, y1: 0, x2: 10, y2: 0, class: "lo" }, cross);
  el("line", { x1: 0, y1: -10, x2: 0, y2: 10, class: "lo" }, cross);

  let scale = 1;
  let hovered: SVGLineElement | undefined;

  function setGridWarp(amount: number): void {
    for (const line of gridLines) {
      const pts: string[] = [];
      for (let t = -320; t <= 320; t += amount > 0 ? 8 : 640) {
        const [x, y] = line.horizontal ? [t, line.v] : [line.v, t];
        const [wx, wy] = warpPoint(x, y, amount);
        pts.push(`${wx.toFixed(1)},${wy.toFixed(1)}`);
      }
      line.node.setAttribute("points", pts.join(" "));
    }
  }
  setGridWarp(0);

  function setOffset(offset: number): void {
    ring.setAttribute("transform", `rotate(${offset.toFixed(3)})`);
    const span = Math.abs(offset);
    arrow.style.display = span < 0.5 ? "none" : "";
    if (span >= 0.5) {
      const dir = Math.sign(offset);
      arrowPath.setAttribute("d", arcPath(R_ARROW, offset, dir * 3));
      const tip = polar(R_ARROW, dir * 3);
      const back = polar(R_ARROW, dir * Math.min(9, span));
      const nx = (tip[0] / R_ARROW) * 5;
      const ny = (tip[1] / R_ARROW) * 5;
      arrowHead.setAttribute(
        "d",
        `M ${tip[0]} ${tip[1]} L ${back[0] + nx} ${back[1] + ny} M ${tip[0]} ${tip[1]} L ${back[0] - nx} ${back[1] - ny}`,
      );
    }
    const [px, py] = polar(R_HULL + 22, offset);
    const [ox, oy] = polar(R_BEZEL + 46, offset);
    const right = ox >= 0;
    const lx = ox + (right ? 34 : -34);
    leader.setAttribute("points", `${px},${py} ${ox},${oy} ${lx},${oy}`);
    affordText.setAttribute("x", String(lx + (right ? 6 / scale : -6 / scale)));
    affordText.setAttribute("y", String(oy));
    affordText.setAttribute("text-anchor", right ? "start" : "end");
    affordText.setAttribute("dominant-baseline", "middle");
  }

  return {
    root: svg,
    setOffset,
    setLocked(locked) {
      svg.classList.toggle("is-locked", locked);
      portLight.classList.toggle("is-on", locked);
    },
    setDraw(progress) {
      for (const layer of Object.keys(drawMasks) as DrawLayer[]) {
        drawMasks[layer].setAttribute("d", wedge(Math.max(0, Math.min(1, progress[layer])) * 360));
      }
    },
    setHoverTick(angle) {
      const next = angle === undefined ? undefined : ticks.get(((Math.round(angle / 5) * 5) % 360 + 360) % 360);
      if (next === hovered) return;
      hovered?.classList.remove("is-hover");
      next?.classList.add("is-hover");
      hovered = next;
    },
    setAligned(aligned) {
      ticks.get(0)?.classList.toggle("is-aligned", aligned);
    },
    setGridWarp,
    setRenderedSize(px) {
      scale = px / 640;
      svg.style.setProperty("--svg-9", `${(9.5 / scale).toFixed(2)}px`);
      svg.style.setProperty("--svg-11", `${(11 / scale).toFixed(2)}px`);
    },
  };
}
