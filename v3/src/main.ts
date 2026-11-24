import "@fontsource/antonio/latin-600.css";
import "@fontsource/antonio/latin-700.css";
import "@fontsource/jetbrains-mono/latin-400.css";
import "@fontsource/jetbrains-mono/latin-500.css";
import "@fontsource/ibm-plex-sans-condensed/latin-400.css";
import "./tokens.css";
import "./styles.css";

import { buildConsoleFrame } from "./console.ts";
import { buildStation } from "./station.ts";
import { drawStars, makeStars, type Rect } from "./starfield.ts";
import type { WarpParams, WarpRenderer } from "./warp/warp.ts";

// V3 — DOCK. One rAF loop drives the SVG instrument, console and readouts; vgpu renders only the
// lock moment (warp + nebula). Spec: v3/VARIANT_BRIEF.md. Look and motion: ART_DIRECTION_space-station.md.

const $ = <T extends Element = HTMLElement>(selector: string) => {
  const el = document.querySelector<T>(selector);
  if (!el) throw new Error(`Missing element: ${selector}`);
  return el;
};

// ---------------------------------------------------------------- constants (brief §5)
const TOLERANCE = 1.5; // degrees: inside this, the hold runs
const MAGNET = 3; // degrees: inside this, the ring eases to exactly 0
const MAGNET_TAU = 0.07; // s: exponential approach ≈ 280 ms to settle, no overshoot
const MAGNET_MAX_DRAG_SPEED = 20; // °/s: while dragging slower than this, the assist also applies
const HOLD_S = 1; // s to fill the hold segment
const DRAIN_S = 0.28; // s to drain it
const IDLE_MS = 6000; // no input → autopilot (timer starts after the console boot)
const AUTOPILOT_MS = 3500; // always ~3.5 s, whatever the offset
const DRIFT = 3; // °/s: the ring's slow turn (120 s period), away from the port, capped
const DRIFT_CAP = 120;
const LOCK_MS = 1200; // lock → online signature
const BOOT = { stars: 0, draw: 600, console: 1800, tick: 2100, affordance: 2900, end: 3200 };
const TOUCH_DECIDE_PX = 10;
const TOUCH_SWEEP_DEG = 6;

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2); // autopilot
const easeSystem = (t: number) => 1 - (1 - t) ** 3; // ≈ cubic-bezier(0.2, 0, 0, 1)
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
const wrap = (deg: number) => ((((deg + 180) % 360) + 360) % 360) - 180;

// ---------------------------------------------------------------- elements
const root = document.documentElement;
const mobileQuery = matchMedia("(max-width: 767px)");
const motionQuery = matchMedia("(prefers-reduced-motion: reduce)");
let reduced = motionQuery.matches;
const css = getComputedStyle(root);
const token = (name: string) => css.getPropertyValue(name).trim();

const hero = $("[data-hero]");
const stage = $("[data-stage]");
const station = buildStation($<SVGSVGElement>("[data-station]"));
const frame = buildConsoleFrame($<SVGSVGElement>("[data-console-frame]"), () => mobileQuery.matches);
const consoleEl = $("[data-console]");
const starCanvas = $<HTMLCanvasElement>("[data-stars]");
const warpCanvas = $<HTMLCanvasElement>("[data-warp]");
const nebula = $("[data-nebula]");
const statusEl = $("[data-status]");
const statusCode = $("[data-status-code]");
const rangeEl = $("[data-range]");
const rateEl = $("[data-rate]");
const offsetEl = $("[data-offset]");
const announcer = $("[data-announcer]");
const replayButton = $<HTMLButtonElement>("[data-replay]");
const stars = makeStars(mobileQuery.matches ? 110 : 220, {
  hi: token("--line-hi"),
  warm: token("--w-cream"),
  cool: token("--c-periwink"),
});

// ---------------------------------------------------------------- state
type Phase = "boot" | "standby" | "autopilot" | "locked" | "online";

const s = {
  phase: "boot" as Phase,
  offset: 47.3,
  hold: 0,
  bootStart: 0,
  bootDone: false,
  bootDoneAt: 0,
  lastInput: 0,
  touched: false, // any user input since boot (status STANDBY → ALIGNING)
  dragging: false,
  dragAngle: 0,
  dragSpeed: 0,
  autoFrom: 0,
  autoStart: 0,
  lockStart: 0,
  onlineFired: false,
  rangeShown: 240,
  parallax: [[0, 0], [0, 0], [0, 0]] as [number, number][],
  parallaxTarget: [0, 0] as [number, number],
};

let warp: WarpRenderer | undefined;
let warpFailed = false;
let last = performance.now();
let raf = 0;
let avoidRects: Rect[] = [];

const randomOffset = () => (30 + Math.random() * 60) * (Math.random() < 0.5 ? -1 : 1);

// ---------------------------------------------------------------- readouts
const fmtOffset = (v: number) => Math.abs(v).toFixed(1);
const SCRAMBLE = "0123456789";

const tickTokens = new WeakMap<HTMLElement, number>();

/** Readout tick (§8.3): count up, mono scramble for the last 200 ms, ≤ 900 ms total. A newer tick on the
 *  same element cancels the older one. */
function tick(el: HTMLElement, to: number, decimals: number, ms = 700): void {
  const token = (tickTokens.get(el) ?? 0) + 1;
  tickTokens.set(el, token);
  if (reduced) {
    el.textContent = to.toFixed(decimals);
    return;
  }
  const start = performance.now();
  const step = (now: number) => {
    if (tickTokens.get(el) !== token) return;
    const t = clamp01((now - start) / ms);
    let text = (to * easeSystem(t)).toFixed(decimals);
    if (t > 1 - 200 / ms && t < 1) text = text.replace(/\d/g, () => SCRAMBLE[Math.floor(Math.random() * 10)]!);
    el.textContent = t >= 1 ? to.toFixed(decimals) : text;
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function setStatus(word: string, code = "26-4 · Status"): void {
  if (statusEl.textContent !== word) statusEl.textContent = word;
  if (statusCode.textContent !== code) statusCode.textContent = code;
  root.classList.toggle("is-standby", word === "Standby" && !reduced);
  root.classList.toggle("is-autopilot", word === "Autopilot");
}

function rangeFor(offset: number): number {
  return 18 + 222 * Math.min(1, Math.abs(offset) / 90);
}

// ---------------------------------------------------------------- warp (signature)
function renderWarp(p: WarpParams): void {
  if (warp && !warpFailed) {
    warp.render(p);
  } else {
    station.setGridWarp(p.amount);
    nebula.style.opacity = String(p.bloom);
  }
}

function resetWarp(): void {
  root.classList.remove("has-warp");
  station.setGridWarp(0);
  nebula.style.opacity = "0";
  warp?.render({ amount: 0, bloom: 0, time: 0, gridAlpha: 0 });
}

// ---------------------------------------------------------------- phases
function startBoot(): void {
  s.phase = "boot";
  s.bootStart = performance.now();
  s.bootDone = false;
  s.touched = false;
  s.hold = 0;
  s.onlineFired = false;
  s.offset = randomOffset();
  root.dataset.state = "standby";
  root.classList.remove("is-booted", "boot-console", "boot-labels", "boot-affordance", "is-locked-ui", "has-touched");
  root.classList.add("is-booting");
  frame.setOnline(false);
  frame.setHold(0);
  station.setLocked(false);
  station.setAligned(false);
  station.setDraw({ bezel: 0, hull: 0, inner: 0, hub: 0 });
  resetWarp();
  setStatus("Standby");
  rangeEl.textContent = "0";
  rateEl.textContent = "0.00";
  offsetEl.textContent = "0.0";
  if (reduced) finishBoot();
}

/** End of beat 3 (also the skip target). Starts the idle timer. */
function finishBoot(): void {
  if (s.bootDone) return;
  s.bootDone = true;
  s.bootDoneAt = performance.now();
  root.classList.remove("is-booting");
  root.classList.add("is-booted", "boot-console", "boot-labels", "boot-affordance");
  station.setDraw({ bezel: 1, hull: 1, inner: 1, hub: 1 });
  s.phase = "standby";
  s.lastInput = performance.now();
  s.rangeShown = rangeFor(s.offset);
  tick(rangeEl, s.rangeShown, 0);
  tick(rateEl, 0.12, 2);
  tick(offsetEl, Math.abs(s.offset), 1);
}

function lock(now: number): void {
  s.phase = "locked";
  s.lockStart = now;
  s.offset = 0;
  s.hold = 1;
  station.setLocked(true);
  setStatus("Locked");
  root.classList.add("is-locked-ui", "has-warp");
  tick(rangeEl, 0, 1, 600);
  tick(rateEl, 0, 2, 600);
  if (reduced) {
    goOnline();
    finishOnline();
  }
}

function goOnline(): void {
  if (s.onlineFired) return;
  s.onlineFired = true;
  setStatus("Online");
  frame.setOnline(true);
  announcer.textContent = "Docked at port 04. Tessaly Ring is online.";
}

function finishOnline(): void {
  s.phase = "online";
  renderWarp({ amount: 1, bloom: 0.55, time: 6, gridAlpha: 0.5 });
  root.dataset.state = "online"; // handoff copy boots in (CSS segment wipe)
}

/** Reduced motion / direct preview: the docked resting state, no animation. */
function showFinalState(): void {
  startBoot();
  finishBoot();
  s.offset = 0;
  rangeEl.textContent = "0.0";
  rateEl.textContent = "0.00";
  offsetEl.textContent = "0.0";
  station.setOffset(0);
  lock(performance.now());
  goOnline();
  finishOnline();
}

// ---------------------------------------------------------------- input
function noteInput(): void {
  const now = performance.now();
  s.lastInput = now;
  if (s.phase === "boot") finishBoot(); // any input skips the boot
  if (s.phase === "autopilot") s.phase = "standby"; // input takes control back
  if (s.phase === "standby" && !s.touched) {
    s.touched = true;
    root.classList.add("has-touched");
  }
}

const canSteer = () => s.phase === "standby" || s.phase === "autopilot" || s.phase === "boot";

function pointerAngle(event: PointerEvent): { angle: number; dist: number } {
  const r = stage.getBoundingClientRect();
  const x = event.clientX - (r.left + r.width / 2);
  const y = event.clientY - (r.top + r.height / 2);
  // Clockwise from 12 o'clock, matching station angles.
  return { angle: (Math.atan2(x, -y) * 180) / Math.PI, dist: Math.hypot(x, y) / (r.width / 2) };
}

let pending: { id: number; x: number; y: number; angle: number } | undefined;
let dragId: number | undefined;
let lastMoveAt = 0;

function beginDrag(event: PointerEvent, angle: number): void {
  dragId = event.pointerId;
  s.dragging = true;
  s.dragAngle = angle;
  s.dragSpeed = 0;
  lastMoveAt = performance.now();
  try {
    stage.setPointerCapture(event.pointerId);
  } catch {
    // capture can fail if the pointer is already gone
  }
  root.classList.add("is-dragging");
  noteInput();
}

stage.addEventListener("pointerdown", (event) => {
  if (!canSteer()) return;
  const { angle, dist } = pointerAngle(event);
  if (dist > 1) return; // only the ring area is a drag target
  if (event.pointerType === "touch") {
    // Decide over the first ~10 px: horizontal or circular → rotate; otherwise let the page scroll.
    pending = { id: event.pointerId, x: event.clientX, y: event.clientY, angle };
    return;
  }
  if (event.button !== 0) return;
  event.preventDefault();
  beginDrag(event, angle);
});

stage.addEventListener("pointermove", (event) => {
  const { angle, dist } = pointerAngle(event);
  if (event.pointerType === "mouse" && !s.dragging) {
    station.setHoverTick(dist <= 1 && s.bootDone ? angle : undefined);
  }
  if (pending && event.pointerId === pending.id) {
    const dx = event.clientX - pending.x;
    const dy = event.clientY - pending.y;
    if (Math.hypot(dx, dy) < TOUCH_DECIDE_PX) return;
    const sweep = Math.abs(wrap(angle - pending.angle));
    const rotate = Math.abs(dx) > Math.abs(dy) || sweep > TOUCH_SWEEP_DEG;
    const start = pending;
    pending = undefined;
    if (rotate) beginDrag(event, start.angle);
    return; // a vertical swipe is the browser's (touch-action: pan-y)
  }
  if (!s.dragging || event.pointerId !== dragId) return;
  const now = performance.now();
  const delta = wrap(angle - s.dragAngle);
  s.dragAngle = angle;
  const dt = Math.max(1, now - lastMoveAt) / 1000;
  lastMoveAt = now;
  s.dragSpeed = Math.abs(delta) / dt;
  s.offset = wrap(s.offset + delta);
  noteInput();
});

const endDrag = (event: PointerEvent) => {
  if (pending && event.pointerId === pending.id) pending = undefined;
  if (event.pointerId !== dragId) return;
  dragId = undefined;
  s.dragging = false;
  s.dragSpeed = 0;
  root.classList.remove("is-dragging");
  if (reduced && Math.abs(s.offset) <= MAGNET) s.offset = 0; // instant assist
  noteInput();
};
stage.addEventListener("pointerup", endDrag);
stage.addEventListener("pointercancel", endDrag);
stage.addEventListener("pointerleave", (event) => {
  if (event.pointerType === "mouse") station.setHoverTick(undefined);
});

stage.addEventListener("keydown", (event) => {
  if (!canSteer()) return;
  const step = event.shiftKey ? 10 : 1;
  let handled = true;
  if (event.key === "ArrowRight" || event.key === "ArrowUp") s.offset = wrap(s.offset + step);
  else if (event.key === "ArrowLeft" || event.key === "ArrowDown") s.offset = wrap(s.offset - step);
  else if (event.key === "Home") s.offset = 0;
  else handled = false;
  if (!handled) return;
  event.preventDefault();
  noteInput();
});

// Any click or key during the boot skips it (brief §4).
window.addEventListener("pointerdown", () => s.phase === "boot" && finishBoot(), { capture: true });
window.addEventListener("keydown", () => s.phase === "boot" && finishBoot(), { capture: true });

// Starfield parallax target from the pointer (stars move, instruments stay still).
hero.addEventListener("pointermove", (event) => {
  if (event.pointerType !== "mouse" || reduced) return;
  const r = hero.getBoundingClientRect();
  s.parallaxTarget = [(event.clientX - r.left) / r.width - 0.5, (event.clientY - r.top) / r.height - 0.5];
});
hero.addEventListener("pointerleave", () => {
  s.parallaxTarget = [0, 0];
});

replayButton.addEventListener("click", () => {
  startBoot();
  stage.focus({ preventScroll: true });
});

$("[data-cta]").addEventListener("click", (event) => {
  event.preventDefault();
  const mission = $("#mission");
  mission.scrollIntoView({ behavior: reduced ? "auto" : "smooth" });
  mission.focus({ preventScroll: true });
});

// ---------------------------------------------------------------- loop
function update(now: number, dt: number): void {
  // Boot timeline
  if (s.phase === "boot") {
    const t = now - s.bootStart;
    const p = (from: number) => clamp01((t - from) / 600);
    station.setDraw({ bezel: p(BOOT.draw), hull: p(BOOT.draw + 200), inner: p(BOOT.draw + 400), hub: p(BOOT.draw + 600) });
    root.classList.toggle("boot-labels", t > BOOT.draw + 900);
    if (t > BOOT.console && !root.classList.contains("boot-console")) root.classList.add("boot-console");
    if (t > BOOT.affordance) root.classList.add("boot-affordance");
    if (t > BOOT.tick && rangeEl.textContent === "0") {
      s.rangeShown = rangeFor(s.offset);
      tick(rangeEl, s.rangeShown, 0);
      tick(rateEl, 0.12, 2);
      tick(offsetEl, Math.abs(s.offset), 1);
    }
    if (t >= BOOT.end) finishBoot();
  }

  if (s.phase === "standby" || s.phase === "autopilot") {
    // Autopilot: after 6 s idle (timer starts at boot end), dock in ~3.5 s, easeInOut, no overshoot.
    if (s.phase === "standby" && !reduced && !s.dragging && now - s.lastInput >= IDLE_MS && Math.abs(s.offset) > TOLERANCE) {
      s.phase = "autopilot";
      s.autoFrom = s.offset;
      s.autoStart = now;
    }
    if (s.phase === "autopilot") {
      const t = clamp01((now - s.autoStart) / AUTOPILOT_MS);
      s.offset = s.autoFrom * (1 - easeInOut(t));
    } else if (!s.dragging && !reduced) {
      const a = Math.abs(s.offset);
      if (a <= MAGNET && a > 0) {
        s.offset *= Math.exp(-dt / MAGNET_TAU); // magnetic assist
        if (Math.abs(s.offset) < 0.01) s.offset = 0;
      } else if (a > MAGNET && a < DRIFT_CAP) {
        s.offset = wrap(s.offset + Math.sign(s.offset) * DRIFT * dt); // the ring keeps turning
      }
    } else if (s.dragging && !reduced && Math.abs(s.offset) <= MAGNET && s.dragSpeed < MAGNET_MAX_DRAG_SPEED) {
      s.offset *= Math.exp(-dt / MAGNET_TAU);
    }
    s.dragSpeed *= Math.exp(-dt / 0.15); // a still pointer reads as slow

    // Hold: fills while inside tolerance, drains outside. Same path for manual and autopilot docks.
    const inside = Math.abs(s.offset) <= TOLERANCE;
    if (reduced) s.hold = inside ? 1 : 0;
    else s.hold = clamp01(s.hold + (inside ? dt / HOLD_S : -dt / DRAIN_S));
    station.setAligned(inside);

    if (s.phase === "autopilot") setStatus("Autopilot", "09 · Autopilot");
    else if (inside) setStatus("Hold");
    else setStatus(s.touched ? "Aligning" : "Standby");

    if (s.hold >= 1) lock(now);
  }

  // Signature: lock → warp + nebula → ONLINE → handoff
  if (s.phase === "locked") {
    const t = clamp01((now - s.lockStart) / LOCK_MS);
    const bloom = Math.min(1, t / 0.4) * (1 - 0.45 * clamp01((t - 0.4) / 0.6));
    renderWarp({ amount: easeSystem(t), bloom, time: 6 * t, gridAlpha: 0.5 });
    if (t >= 0.5) goOnline();
    if (t >= 1) finishOnline();
  }

  // Live readouts (after their boot tick)
  if (s.bootDone && (s.phase === "standby" || s.phase === "autopilot")) {
    if (s.touched || s.phase === "autopilot" || now - s.bootDoneAt > 750) {
      tickTokens.set(offsetEl, (tickTokens.get(offsetEl) ?? 0) + 1); // live value wins over the boot tick
      offsetEl.textContent = fmtOffset(s.offset);
      const range = rangeFor(s.offset);
      if (Math.abs(range - s.rangeShown) >= 1) {
        s.rangeShown = range;
        tickTokens.set(rangeEl, (tickTokens.get(rangeEl) ?? 0) + 1);
        rangeEl.textContent = range.toFixed(0);
      }
    }
  }

  station.setOffset(s.offset);
  frame.setHold(s.phase === "online" || s.phase === "locked" ? 1 : s.hold);
  stage.setAttribute("aria-valuenow", s.offset.toFixed(1));
  stage.setAttribute(
    "aria-valuetext",
    Math.abs(s.offset) < 0.05 ? "Aligned with port 04" : `${fmtOffset(s.offset)} degrees ${s.offset > 0 ? "right" : "left"} of port`,
  );

  // Starfield: parallax ±4 / ±8 / ±14 px, eased; redraw each frame (≈200 arcs).
  const depth = [4, 8, 14];
  for (let i = 0; i < 3; i++) {
    const k = 1 - Math.exp(-dt / 0.6);
    s.parallax[i]![0] += (s.parallaxTarget[0] * depth[i]! * 2 - s.parallax[i]![0]) * k;
    s.parallax[i]![1] += (s.parallaxTarget[1] * depth[i]! * 2 - s.parallax[i]![1]) * k;
  }
  drawStars(starCanvas, stars, avoidRects, s.parallax, reduced ? 0 : now / 1000);
}

function loop(now: number): void {
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
  last = now;
  update(now, dt);
  raf = requestAnimationFrame(loop);
}

function startLoop(): void {
  if (raf) return;
  last = performance.now();
  raf = requestAnimationFrame(loop);
}
function stopLoop(): void {
  cancelAnimationFrame(raf);
  raf = 0;
}
document.addEventListener("visibilitychange", () => (document.hidden ? stopLoop() : startLoop()));

// ---------------------------------------------------------------- layout
function layout(): void {
  station.setRenderedSize(stage.clientWidth);
  frame.layout();
  const host = starCanvas.getBoundingClientRect();
  avoidRects = [".console__readouts", ".handoff", ".topbar", ".caption"].map((sel) => {
    const r = $(sel).getBoundingClientRect();
    const pad = 10;
    return { x0: r.left - host.left - pad, y0: r.top - host.top - pad, x1: r.right - host.left + pad, y1: r.bottom - host.top + pad };
  });
  drawStars(starCanvas, stars, avoidRects, s.parallax, 0);
}
window.addEventListener("resize", layout, { passive: true });
mobileQuery.addEventListener("change", layout);
// Copy lands at handoff; refresh the star exclusion zones once it's there.
new MutationObserver(() => requestAnimationFrame(layout)).observe(root, { attributes: true, attributeFilter: ["data-state"] });

motionQuery.addEventListener("change", (event) => {
  reduced = event.matches;
  root.classList.toggle("reduce-motion", reduced);
});

// ---------------------------------------------------------------- start
layout();
document.fonts.ready.then(layout);
if (reduced || new URLSearchParams(location.search).get("state") === "online") showFinalState();
else startBoot();
startLoop();

// The warp renderer loads in the background; the docking never waits for it.
void import("./warp/warp.ts").then(async ({ createWarpRenderer }) => {
  warp = await createWarpRenderer(warpCanvas, (error) => {
    warpFailed = true;
    root.classList.add("no-gpu-warp");
    console.warn("[tessaly] warp unavailable, using the SVG fallback", error);
    if (s.phase === "online") renderWarp({ amount: 1, bloom: 0.55, time: 6, gridAlpha: 0.5 });
  });
  if (!warp) {
    warpFailed = true;
    root.classList.add("no-gpu-warp");
  } else {
    root.classList.add("gpu-warp");
  }
  if (s.phase === "online") renderWarp({ amount: 1, bloom: 0.55, time: 6, gridAlpha: 0.5 });
});
