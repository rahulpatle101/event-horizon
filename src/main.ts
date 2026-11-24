import "@fontsource/instrument-serif/latin-400.css";
import "@fontsource/instrument-serif/latin-400-italic.css";
import "@fontsource-variable/inter-tight/wght.css";
import "@fontsource/ibm-plex-mono/latin-400.css";
import "@fontsource/ibm-plex-mono/latin-500.css";
import "./styles.css";

import type { FailureReason, Renderer } from "./blackhole/renderer.ts";
import { FRAMINGS } from "./blackhole/settings.ts";
import { createDeckAudio, type Cue } from "./deck/audio.ts";
import { createSpace, type View } from "./deck/space.ts";
import { anchorPositions, type AnchorId } from "./encounter/anchors.ts";
import { appendEntry, readLog, type LogEntry } from "./encounter/log.ts";

const root = document.documentElement;
const $ = <T extends Element = HTMLElement>(selector: string) => {
  const el = document.querySelector<T>(selector);
  if (!el) throw new Error(`Missing element: ${selector}`);
  return el;
};
const $$ = <T extends Element = HTMLElement>(selector: string) => [...document.querySelectorAll<T>(selector)];

const canvas = $<HTMLCanvasElement>(".stage__canvas");
const chrome = $("[data-chrome]");
const consoleEl = $("[data-console]");
const consoleStatus = $("[data-console-status]");
const findings = $("[data-findings]");
const panel = $<HTMLDialogElement>("[data-briefing]");
const renderStatus = $("[data-render-status]");
const announcer = $("[data-announcer]");
const beginButton = $<HTMLButtonElement>("[data-begin]");
const exitButton = $<HTMLButtonElement>("[data-exit-observe]");
const scanButton = $<HTMLButtonElement>("[data-scan]");
const recordButton = $<HTMLButtonElement>("[data-record]");
const annotationsToggle = $<HTMLButtonElement>("[data-annotations-toggle]");
const openLogButtons = $$<HTMLButtonElement>("[data-open-log]");
const pauseButtons = [$<HTMLButtonElement>("[data-pause]"), $<HTMLButtonElement>("[data-pause-observe]")];
const annotationLines = $<SVGSVGElement>("[data-annotation-lines]");
const findingText = $("[data-finding-text]");
const spaceCanvas = $<HTMLCanvasElement>("[data-space]");
const audio = createDeckAudio();
let space: ReturnType<typeof createSpace> | undefined;

const motionQuery = matchMedia("(prefers-reduced-motion: reduce)");
const mobileQuery = matchMedia("(max-width: 767px)");

/**
 * Encounter flow: arrival → observe → (scanning) → investigated → recorded.
 * `observing` is whether the science view is open; scan/record progress survives a return
 * to arrival so the visitor can come back to their findings.
 */
type Scan = "idle" | "scanning" | "complete";
const state = {
  live: false,
  paused: motionQuery.matches,
  observing: false,
  scan: "idle" as Scan,
  recorded: undefined as { entry: LogEntry; persisted: boolean } | undefined,
  annotations: true,
  selected: undefined as AnchorId | undefined,
  moving: false, // camera approach in progress
  reframing: 0,
  scanTimer: 0,
};

let renderer: Renderer | undefined;

const announce = (message: string) => {
  announcer.textContent = "";
  // A fresh text node after a tick makes repeated messages announce reliably.
  window.setTimeout(() => (announcer.textContent = message), 60);
};

// ---------------------------------------------------------------- pause

function syncPauseButtons(): void {
  for (const button of pauseButtons) {
    // Visible whenever anything moves: the live render, or the deck around the fallback poster.
    button.hidden = !state.live && motionQuery.matches;
    button.setAttribute("aria-pressed", String(state.paused));
    const label = button.querySelector("[data-pause-label]");
    if (label) label.textContent = state.paused ? "Resume motion" : "Pause motion";
  }
}

function setPaused(paused: boolean): void {
  state.paused = paused;
  renderer?.setPaused(paused);
  space?.setPaused(paused); // pause means all motion, including the deck
  syncPauseButtons();
}

for (const button of pauseButtons) button.addEventListener("click", () => setPaused(!state.paused));

motionQuery.addEventListener("change", (event) => {
  root.classList.toggle("reduce-motion", event.matches);
  setPaused(event.matches);
});

// ------------------------------------------------------------ rendering UI

/** Single place that maps encounter state onto the DOM. */
function render(): void {
  const stage = !state.observing
    ? "arrival"
    : state.recorded
      ? "record"
      : state.scan === "complete"
        ? "investigate"
        : "observe";
  root.dataset.stage = stage;
  root.classList.toggle("is-observing", state.observing);
  root.classList.toggle("is-scanning", state.scan === "scanning");
  root.classList.toggle("has-results", state.observing && state.scan === "complete" && state.annotations);

  const order = ["observe", "investigate", "record"];
  const current = state.recorded ? 2 : state.scan === "complete" ? 1 : 0;
  for (const li of $$("[data-step]")) {
    const i = order.indexOf(li.dataset.step ?? "");
    li.classList.toggle("is-done", i < current || (i === 2 && Boolean(state.recorded)));
    if (i === current) li.setAttribute("aria-current", "step");
    else li.removeAttribute("aria-current");
  }

  scanButton.hidden = state.scan === "complete";
  // aria-disabled (not disabled) keeps the button focusable while the camera settles.
  scanButton.setAttribute("aria-disabled", String(state.scan === "scanning" || state.moving));
  scanButton.textContent = state.scan === "scanning" ? "Scanning…" : "Scan black hole";
  findings.hidden = state.scan !== "complete";
  annotationsToggle.hidden = state.scan !== "complete";
  annotationsToggle.setAttribute("aria-pressed", String(state.annotations));
  annotationsToggle.textContent = state.annotations ? "Hide annotations" : "Show annotations";
  recordButton.hidden = state.scan !== "complete" || Boolean(state.recorded);

  const hasLog = readLog().length > 0;
  for (const button of openLogButtons) {
    const inConsole = Boolean(button.closest("[data-console]"));
    button.hidden = inConsole ? !state.recorded : !hasLog;
  }

  consoleStatus.textContent = state.moving
    ? "Approaching…"
    : state.scan === "scanning"
      ? "Scanning the field of view…"
      : state.recorded
        ? state.recorded.persisted
          ? `${state.recorded.entry.name} recorded · saved in this browser.`
          : `${state.recorded.entry.name} recorded · this browser can't store it, so it lasts until you leave the page.`
        : state.scan === "complete"
          ? "Scan complete. Three features identified."
          : state.live
            ? "Observing. Drag, or use ← → keys, to turn the view."
            : "Observing a static preview of the rendered scene.";

  for (const button of $$<HTMLButtonElement>("[data-finding]")) {
    button.setAttribute("aria-pressed", String(button.dataset.finding === state.selected));
  }
  for (const label of $$("[data-annotation]")) {
    const id = label.dataset.annotation;
    label.classList.toggle("is-selected", id === state.selected);
    label.classList.toggle("is-dim", Boolean(state.selected) && id !== state.selected);
  }
  findingText.textContent = state.selected
    ? `${FINDINGS[FINDING_INDEX[state.selected]]!.title}. ${FINDINGS[FINDING_INDEX[state.selected]]!.text.replace(/(\d) ?Rs\b/g, "$1 Rs")}`
    : "Three features identified. Select one to read about it.";

  positionAnnotations();
  syncSill();
}

// ------------------------------------------------------------- annotations

const POSTERS = {
  desktop: { width: 1920, height: 1080 },
  mobile: { width: 780, height: 1688 },
};

/** Label offsets (× viewport height). The shadow's label sits inside the shadow itself (it's black, so it's
 *  perfectly legible and needs no leader); the others stay short and clear of the bright arc. */
const LABEL_OFFSET: Record<AnchorId, [number, number]> = {
  shadow: [0, 0.05],
  ring: [-0.11, -0.07],
  disk: [0.02, 0.1],
};

let lastAnchors: Record<AnchorId, { x: number; y: number }> | undefined;

function positionAnnotations(): void {
  if (!state.observing || state.scan === "idle" || state.moving) return;
  const width = window.innerWidth;
  const height = window.innerHeight;
  const mobile = mobileQuery.matches;
  const anchors = anchorPositions(mobile ? "observeMobile" : "observe", {
    width,
    height,
    poster: state.live ? undefined : mobile ? POSTERS.mobile : POSTERS.desktop,
  });
  annotationLines.setAttribute("viewBox", `0 0 ${width} ${height}`);
  let lines = "";
  for (const id of Object.keys(anchors) as AnchorId[]) {
    const a = anchors[id];
    const label = $(`[data-annotation="${id}"]`);
    if (mobile) {
      // Numbered markers only; explanations are in the console list.
      const mx = Math.min(width - 26, Math.max(26, a.x));
      label.style.transform = `translate(${mx}px, ${a.y}px) translate(-50%, -50%)`;
      lines += `<g class="ann-line" data-line="${id}"><circle cx="${a.x}" cy="${a.y}" r="15" /></g>`;
      continue;
    }
    if (id === "shadow") {
      label.style.transform = `translate(${a.x}px, ${a.y + LABEL_OFFSET.shadow[1] * height}px) translate(-50%, -50%)`;
      lines += `<g class="ann-line" data-line="${id}"><circle cx="${a.x}" cy="${a.y}" r="3" /></g>`;
      continue;
    }
    const [ox, oy] = LABEL_OFFSET[id];
    const w = label.offsetWidth || 200;
    const h = label.offsetHeight || 48;
    const consoleTop = consoleEl.getBoundingClientRect().top || height;
    // Left-pointing labels hang to the left of their leader end; keep both inside the window.
    const lx = ox < 0 ? Math.max(24 + w, a.x + ox * height) : Math.min(width - 24 - w, a.x + ox * height);
    const ly = Math.min(consoleTop - 16 - h / 2, Math.max(24 + h / 2, a.y + oy * height));
    label.style.transform = `translate(${lx}px, ${ly}px) translate(${ox < 0 ? "-100%" : "0"}, -50%)`;
    lines += `<g class="ann-line" data-line="${id}"><circle cx="${a.x}" cy="${a.y}" r="4" /><line x1="${a.x}" y1="${a.y}" x2="${lx}" y2="${ly}" /></g>`;
  }
  // Selecting the photon ring traces it: a hairline drawn around the ring's measured radius.
  if (state.selected === "ring") {
    const c = holeCenter(width, height);
    const r = Math.hypot(anchors.ring.x - c.x, anchors.ring.y - c.y);
    const len = (2 * Math.PI * r).toFixed(0);
    lines += `<circle class="trace" cx="${c.x}" cy="${c.y}" r="${r.toFixed(1)}" style="--len:${len}" />`;
  }
  annotationLines.innerHTML = lines;
  lastAnchors = anchors;
  for (const id of revealed) markRevealed(id);
}

const revealed = new Set<AnchorId>();
function markRevealed(id: AnchorId): void {
  revealed.add(id);
  $(`[data-annotation="${id}"]`).classList.add("is-revealed");
  annotationLines.querySelector(`[data-line="${id}"]`)?.classList.add("is-revealed");
}
function clearRevealed(): void {
  revealed.clear();
  for (const el of $$("[data-annotation]")) el.classList.remove("is-revealed");
}

/** Shadow centre on screen in the current observation framing (live render or cover-fitted poster). */
function holeCenter(width: number, height: number): { x: number; y: number } {
  const f = FRAMINGS[mobileQuery.matches ? "observeMobile" : "observe"];
  return { x: (width / 2) * (1 + f.centerX), y: (height / 2) * (1 - f.centerY) };
}

// ------------------------------------------------------------------- selection

const FINDING_INDEX: Record<AnchorId, number> = { shadow: 0, ring: 1, disk: 2 };
function select(id: AnchorId): void {
  if (state.scan !== "complete") return;
  state.selected = state.selected === id ? undefined : id;
  render();
  audio.cue("reveal", { index: FINDING_INDEX[id] });
}
for (const button of $$<HTMLButtonElement>("[data-finding]")) {
  button.addEventListener("click", () => select(button.dataset.finding as AnchorId));
}
for (const label of $$("[data-select]")) {
  label.addEventListener("click", () => select(label.dataset.select as AnchorId));
}

window.addEventListener("resize", positionAnnotations, { passive: true });
mobileQuery.addEventListener("change", positionAnnotations);

// ----------------------------------------------------------- observation

/**
 * Change camera framing. Live + motion allowed: the renderer eases the camera (approach /
 * retreat). Reduced motion: an instant cut. No live renderer: the fallback posters swap.
 */
function reframe(observing: boolean): void {
  root.classList.toggle("is-observe-framed", observing); // fallback poster swap
  if (!renderer || !state.live || motionQuery.matches) {
    void renderer?.setObserving(observing, false);
    positionAnnotations();
    return;
  }
  state.moving = true;
  render();
  void renderer.setObserving(observing, true).then(() => {
    state.moving = false;
    render();
    if (observing && state.observing) audio.cue("settle");
  });
}

function beginObservation(): void {
  if (state.observing) return;
  if (panel.open) panel.close();
  state.observing = true;
  chrome.inert = true;
  consoleEl.hidden = false;
  audio.cue("approach");
  if (motionQuery.matches || !state.live) window.setTimeout(() => audio.cue("settle"), 200);
  reframe(true);
  render();
  (state.scan === "complete" ? (state.recorded ? exitButton : recordButton) : scanButton).focus({
    preventScroll: true,
  });
  if (state.recorded) openLogButtons.find((b) => b.closest("[data-console]"))?.focus({ preventScroll: true });
}

function returnToArrival(): void {
  if (!state.observing) return;
  if (state.scan === "scanning") cancelScan();
  state.observing = false;
  chrome.inert = false;
  consoleEl.hidden = true;
  audio.cue("return");
  reframe(false);
  render();
  beginButton.focus({ preventScroll: true });
}

beginButton.addEventListener("click", beginObservation);
$("[data-briefing-begin]").addEventListener("click", beginObservation);
exitButton.addEventListener("click", returnToArrival);

document.addEventListener("keydown", (event) => {
  if (!state.observing || panel.open) return;
  if (event.key === "Escape") {
    event.preventDefault();
    returnToArrival();
  } else if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
    if ((event.target as HTMLElement | null)?.closest("input, textarea, details")) return;
    event.preventDefault();
    renderer?.nudgeYaw(event.key === "ArrowLeft" ? -0.18 : 0.18);
  }
});

// Drag to turn the view while observing.
let dragId: number | undefined;
let dragX = 0;
canvas.addEventListener("pointerdown", (event) => {
  if (!state.observing || !state.live) return;
  dragId = event.pointerId;
  dragX = event.clientX;
  canvas.setPointerCapture(event.pointerId);
  root.classList.add("is-dragging");
});
canvas.addEventListener("pointermove", (event) => {
  if (event.pointerId !== dragId) return;
  const dx = event.clientX - dragX;
  dragX = event.clientX;
  renderer?.nudgeYaw((dx / Math.max(window.innerWidth, 1)) * Math.PI);
});
const endDrag = (event: PointerEvent) => {
  if (event.pointerId !== dragId) return;
  dragId = undefined;
  root.classList.remove("is-dragging");
};
canvas.addEventListener("pointerup", endDrag);
canvas.addEventListener("pointercancel", endDrag);

// ------------------------------------------------------------------ scan
// Illustrative scan: a wavefront expands from the shadow centre; each feature resolves as the front
// reaches it, inner to outer (shadow → photon ring → accretion disk).

const SCAN_MS = 1700;
const wavefront = $<SVGSVGElement>("[data-wavefront]");
const wavefrontRing = $<SVGCircleElement>("[data-wavefront-ring]");
let scanRaf = 0;

function completeScan(): void {
  cancelAnimationFrame(scanRaf);
  state.scan = "complete";
  state.annotations = true;
  render();
  for (const id of ["shadow", "ring", "disk"] as AnchorId[]) markRevealed(id);
  wavefront.classList.remove("is-active");
  audio.cue("scanDone");
  audio.duck(0);
  window.setTimeout(() => space?.setLevel(1), 1200);
  announce("Scan complete. Three features identified: shadow, photon ring, and accretion disk.");
  recordButton.focus({ preventScroll: true });
}

function cancelScan(): void {
  cancelAnimationFrame(scanRaf);
  window.clearTimeout(state.scanTimer);
  wavefront.classList.remove("is-active");
  audio.duck(0);
  space?.setLevel(1);
  state.scan = "idle";
}

scanButton.addEventListener("click", () => {
  if (state.scan !== "idle" || state.moving) return;
  clearRevealed();
  state.selected = undefined;
  if (motionQuery.matches) {
    completeScan(); // results without the wavefront
    return;
  }
  state.scan = "scanning";
  render();
  announce("Scanning.");
  space?.setLevel(0.4);
  audio.duck(1);
  audio.cue("scanStart");
  const width = window.innerWidth;
  const height = window.innerHeight;
  const c = holeCenter(width, height);
  const anchors = lastAnchors ?? anchorPositions(mobileQuery.matches ? "observeMobile" : "observe", { width, height });
  const order = (["shadow", "ring", "disk"] as AnchorId[]).map((id) => ({
    id,
    d: id === "shadow" ? 0.12 * height : Math.hypot(anchors[id].x - c.x, anchors[id].y - c.y),
  }));
  const maxR = Math.max(...order.map((o) => o.d)) * 1.25;
  wavefront.setAttribute("viewBox", `0 0 ${width} ${height}`);
  wavefrontRing.setAttribute("cx", String(c.x));
  wavefrontRing.setAttribute("cy", String(c.y));
  wavefront.classList.add("is-active");
  const start = performance.now();
  const step = (now: number) => {
    // rAF timestamps can predate the click's performance.now(); clamp so the radius never goes negative.
    const t = Math.min(1, Math.max(0, (now - start) / SCAN_MS));
    const r = maxR * (1 - (1 - t) ** 3); // decelerating, like focusing
    wavefrontRing.setAttribute("r", r.toFixed(1));
    wavefrontRing.style.opacity = String(0.9 * (1 - t * t));
    for (const [i, o] of order.entries()) {
      if (!revealed.has(o.id) && r >= o.d) {
        markRevealed(o.id);
        audio.cue("reveal", { index: i });
      }
    }
    if (t < 1) scanRaf = requestAnimationFrame(step);
    else completeScan();
  };
  scanRaf = requestAnimationFrame(step);
});

annotationsToggle.addEventListener("click", () => {
  state.annotations = !state.annotations;
  render();
});

// ---------------------------------------------------------------- record

const FINDINGS = [
  { title: "Shadow", text: "A dark region about 2.6 Rs in radius, where light falls in rather than reaching us." },
  { title: "Photon ring", text: "A thin bright line of light that circled the black hole before escaping." },
  {
    title: "Accretion disk",
    text: "Hot gas from 3 to 9 Rs; the approaching side looks brighter and the far side is lensed over the top.",
  },
];

const plate = $("[data-plate]");
const plateImg = $<HTMLImageElement>("[data-plate-img]");

/** Capture the encounter: the rendered frame (plus the deck overlay) cropped to 16:10. Falls back to the
 *  matching observation poster when the live canvas can't be read. */
function capturePlate(): string | undefined {
  try {
    const out = document.createElement("canvas");
    out.width = 480;
    out.height = 300;
    const ctx = out.getContext("2d");
    if (!ctx) return undefined;
    const w = window.innerWidth;
    const h = window.innerHeight;
    const c = holeCenter(w, h);
    const cropH = Math.min(h * 0.78, (w * 300) / 480);
    const cropW = (cropH * 480) / 300;
    const sx = Math.max(0, Math.min(w - cropW, c.x - cropW / 2));
    const sy = Math.max(0, Math.min(h - cropH, c.y - cropH / 2));
    const draw = (source: CanvasImageSource, sw: number, sh: number) =>
      ctx.drawImage(source, (sx / w) * sw, (sy / h) * sh, (cropW / w) * sw, (cropH / h) * sh, 0, 0, 480, 300);
    let usedLive = false;
    if (state.live && canvas.width > 0) {
      draw(canvas, canvas.width, canvas.height);
      const px = ctx.getImageData(240, 150, 1, 1).data; // inside the bright ring area? check any light
      const probe = ctx.getImageData(0, 0, 480, 300).data;
      let lit = 0;
      for (let i = 0; i < probe.length; i += 4 * 97) lit += probe[i]! + probe[i + 1]! + probe[i + 2]!;
      usedLive = lit > 2000 || px[0]! > 0;
    }
    if (!usedLive) {
      const poster = document.querySelector<HTMLImageElement>(".stage__picture--observe .stage__poster");
      if (!poster?.complete || !poster.naturalWidth) return undefined;
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, 480, 300);
      // object-fit: cover crop of the poster, matched to the viewport crop above
      const scale = Math.max(w / poster.naturalWidth, h / poster.naturalHeight);
      const f = FRAMINGS[mobileQuery.matches ? "observeMobile" : "observe"];
      const ox = (w - poster.naturalWidth * scale) * ((1 + f.centerX) / 2);
      const oy = (h - poster.naturalHeight * scale) * ((1 - f.centerY) / 2);
      ctx.drawImage(poster, (sx - ox) / scale, (sy - oy) / scale, cropW / scale, cropH / scale, 0, 0, 480, 300);
    }
    if (spaceCanvas.width > 0) draw(spaceCanvas, spaceCanvas.width, spaceCanvas.height);
    return out.toDataURL("image/jpeg", 0.82);
  } catch {
    return undefined; // a tainted or lost canvas just means no thumbnail
  }
}

/** The plate flies from the window into the log button. */
function flyPlate(src: string | undefined, title: string, time: string): void {
  const target = openLogButtons.find((b) => b.closest("[data-console]"));
  if (!src || !target || motionQuery.matches) return;
  plateImg.src = src;
  $("[data-plate-title]").textContent = title;
  $("[data-plate-time]").textContent = time;
  plate.hidden = false;
  const win = $("[data-window]").getBoundingClientRect();
  const startW = Math.min(win.width * 0.46, 560);
  const startH = startW * (300 / 480) + 40;
  const from = { x: win.left + (win.width - startW) / 2, y: win.top + (win.height - startH) / 2 };
  plate.style.width = `${startW}px`;
  const to = target.getBoundingClientRect();
  const scale = Math.max(0.08, to.width / startW);
  root.classList.add("is-shutter-snap");
  window.setTimeout(() => root.classList.remove("is-shutter-snap"), 200);
  const anim = plate.animate(
    [
      { transform: `translate(${from.x}px, ${from.y}px) scale(1.04)`, opacity: 0 },
      { transform: `translate(${from.x}px, ${from.y}px) scale(1)`, opacity: 1, offset: 0.18 },
      { transform: `translate(${from.x}px, ${from.y}px) scale(1)`, opacity: 1, offset: 0.45 },
      { transform: `translate(${to.left + to.width / 2 - (startW * scale) / 2}px, ${to.top + to.height / 2 - (startH * scale) / 2}px) scale(${scale})`, opacity: 0.2 },
    ],
    { duration: 1300, easing: "cubic-bezier(0.2, 0, 0, 1)", fill: "forwards" },
  );
  anim.onfinish = () => {
    plate.hidden = true;
    anim.cancel();
    target.classList.add("is-received");
    window.setTimeout(() => target.classList.remove("is-received"), 700);
  };
}

recordButton.addEventListener("click", () => {
  if (state.scan !== "complete" || state.recorded) return;
  const thumb = capturePlate();
  state.recorded = appendEntry({
    findings: FINDINGS,
    geometry: [
      { label: "Standoff", value: "13.5 Rs" },
      { label: "Inclination", value: "9.2°" },
    ],
    thumb,
  });
  audio.cue("record");
  space?.setLevel(0.5);
  window.setTimeout(() => space?.setLevel(1), 1400);
  render();
  flyPlate(thumb, state.recorded.entry.name, formatDate(state.recorded.entry.recordedAt));
  announce(
    state.recorded.persisted
      ? `${state.recorded.entry.name} recorded and saved in this browser.`
      : `${state.recorded.entry.name} recorded for this visit only; browser storage is unavailable.`
  );
  openLogButtons.find((b) => b.closest("[data-console]"))?.focus({ preventScroll: true });
});

// ----------------------------------------------------- panel (log + brief)

const logSection = $("[data-log]");
const logEntries = $("[data-log-entries]");
const logPersistence = $("[data-log-persistence]");
let panelOpener: HTMLElement | null = null;

const formatDate = (iso: string) => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? iso
    : date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
};

function renderLog(): void {
  const entries = readLog();
  logSection.hidden = entries.length === 0;
  logPersistence.textContent =
    state.recorded && !state.recorded.persisted
      ? "Kept for this visit only. This browser isn't allowing local storage."
      : "Saved in this browser only. Nothing is sent anywhere.";
  logEntries.replaceChildren(
    ...[...entries].reverse().map((entry) => {
      const article = document.createElement("article");
      article.className = "log-entry";
      const subs = (text: string) => text.replace(/(\d) ?Rs\b/g, "$1 R<sub>s</sub>");
      article.innerHTML = `
        <header class="log-entry__head">
          <h3></h3>
          <p><time datetime=""></time> · Illustrative scan</p>
        </header>
        <ol class="log-entry__findings"></ol>
        <dl class="log-entry__geometry"></dl>`;
      article.querySelector("h3")!.textContent = entry.name;
      if (entry.thumb) {
        const img = document.createElement("img");
        img.className = "log-entry__plate";
        img.src = entry.thumb;
        img.alt = `Captured view of ${entry.name}: the rendered black hole at the time of the scan (illustrative simulation).`;
        article.prepend(img);
      }
      const time = article.querySelector("time")!;
      time.dateTime = entry.recordedAt;
      time.textContent = formatDate(entry.recordedAt);
      const list = article.querySelector("ol")!;
      for (const f of entry.findings) {
        const li = document.createElement("li");
        const strong = document.createElement("strong");
        strong.textContent = `${f.title}. `;
        const span = document.createElement("span");
        // Only our own fixed findings text reaches here; escape anyway before adding subscripts.
        span.innerHTML = subs(f.text.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`));
        li.append(strong, span);
        list.append(li);
      }
      const dl = article.querySelector("dl")!;
      for (const g of entry.geometry) {
        const row = document.createElement("div");
        const dt = document.createElement("dt");
        dt.textContent = g.label;
        const dd = document.createElement("dd");
        dd.innerHTML = subs(g.value.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`));
        row.append(dt, dd);
        dl.append(row);
      }
      return article;
    })
  );
}

function openPanel(opener: HTMLElement, focusTarget: "top" | "log" | "credits"): void {
  panelOpener = opener;
  renderLog();
  panel.setAttribute("aria-labelledby", focusTarget === "log" ? "log-title" : "briefing-title");
  panel.dataset.mode = focusTarget === "log" ? "log" : "briefing"; // the log is plates only; the briefing is separate
  panel.showModal();
  if (focusTarget === "top") {
    panel.scrollTop = 0;
    $("[data-close-briefing]").focus();
    return;
  }
  const target = $(focusTarget === "log" ? "[data-log]" : "[data-credits]");
  target.focus({ preventScroll: true });
  target.scrollIntoView({ block: "start" });
}

$("[data-open-briefing]").addEventListener("click", (e) => openPanel(e.currentTarget as HTMLElement, "top"));
$("[data-open-credits]").addEventListener("click", (e) => openPanel(e.currentTarget as HTMLElement, "credits"));
for (const button of openLogButtons) {
  button.addEventListener("click", (e) => openPanel(e.currentTarget as HTMLElement, "log"));
}
$("[data-close-briefing]").addEventListener("click", () => panel.close());
panel.addEventListener("click", (event) => {
  if (event.target === panel) panel.close(); // backdrop
});
panel.addEventListener("close", () => {
  const fallback = state.observing ? exitButton : beginButton;
  const target = panelOpener && panelOpener.isConnected && !panelOpener.hidden ? panelOpener : fallback;
  target.focus({ preventScroll: true });
  panelOpener = null;
});

// ------------------------------------------------------ live rendering

function showFallback(reason: FailureReason, error?: unknown): void {
  state.live = false;
  root.classList.remove("is-loading", "is-live", "is-shutter");
  root.classList.add("is-ready", "is-fallback");
  syncPauseButtons();
  renderStatus.hidden = false;
  renderStatus.textContent =
    reason === "unsupported"
      ? "Static preview · WebGPU is not available in this browser"
      : reason === "device-lost"
        ? "Static preview · the GPU device was lost"
        : "Static preview · live rendering could not start";
  render();
  if (error !== undefined) console.warn(`[event-horizon] ${reason}:`, error);
}

function startRenderer(): void {
  void import("./blackhole/renderer.ts")
    .then(({ createRenderer }) => {
      renderer = createRenderer({
        canvas,
        paused: state.paused,
        onFirstFrame() {
          state.live = true;
          root.classList.remove("is-loading");
          root.classList.add("is-live", "is-ready");
          syncPauseButtons();
          render();
        },
        onFailure(reason, error) {
          renderer = undefined;
          showFallback(reason, error);
        },
      });
      if (state.observing) renderer.setObserving(true);
    })
    .catch((error: unknown) => showFallback("init", error));
}

// Never leave visitors waiting on a GPU that never answers.
window.setTimeout(() => {
  if (!state.live && !root.classList.contains("is-fallback")) {
    renderer?.dispose();
    renderer = undefined;
    showFallback("init", new Error("Timed out waiting for the first frame"));
  }
}, 9000);

if (!("gpu" in navigator)) showFallback("unsupported");
else startRenderer();

render();
requestAnimationFrame(() => root.classList.add("is-ready"));

window.addEventListener("pagehide", (event) => {
  if (!event.persisted) renderer?.dispose();
});

if (import.meta.hot) import.meta.hot.dispose(() => renderer?.dispose());

// ------------------------------------------------------ observation deck

/** The window's bottom edge rises to sit on the console (the sill) while observing. */
function syncSill(): void {
  const sill = state.observing && !consoleEl.hidden ? consoleEl.offsetHeight + 10 : 0;
  root.style.setProperty("--sill", `${sill}px`);
}
new ResizeObserver(syncSill).observe(consoleEl);

function staticView(): View {
  const mobile = mobileQuery.matches;
  const f = FRAMINGS[state.observing ? (mobile ? "observeMobile" : "observe") : mobile ? "mobile" : "desktop"];
  return { centerX: f.centerX, centerY: f.centerY, cameraRoll: f.cameraRoll, fov: f.fov, sceneYaw: 0 };
}

const boxOf = (el: Element | null) => {
  if (!el || (el as HTMLElement).hidden) return undefined;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 ? { x: r.left, y: r.top, w: r.width, h: r.height } : undefined;
};

space = createSpace({
  canvas: spaceCanvas,
  rim: $<HTMLCanvasElement>("[data-rim]"),
  view: () => (state.live && renderer ? renderer.getView() : staticView()),
  // Shadow + lensed arc, in screen space (the bright silhouette that nothing should cross).
  blackHole: (v, w, h) => ({ cx: (w / 2) * (1 + v.centerX), cy: (h / 2) * (1 - v.centerY), r: 0.27 * v.fov * (h / 2) }),
  quiet: () =>
    // The visible copy and controls (not their containers), so the void around them stays usable.
    (state.observing ? [".console", ".sound"] : [".masthead", ".eyebrow", ".headline", ".lede", ".actions", ".telemetry", ".footer", ".sound"])
      .map((sel) => boxOf(document.querySelector(sel)))
      .filter((b): b is NonNullable<typeof b> => Boolean(b)),
  window: () => {
    const el = $("[data-window]");
    const r = el.getBoundingClientRect();
    return { x: r.left, y: r.top, w: r.width, h: r.height, radius: parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0 };
  },
  reducedMotion: () => motionQuery.matches,
  onFlyby: (kind, pan, intensity) => audio.flyby(kind, pan, intensity),
});

space.setPaused(state.paused);

window.addEventListener(
  "pointermove",
  (event) => {
    if (event.pointerType !== "mouse") return;
    space?.setPointer(event.clientX / window.innerWidth - 0.5, event.clientY / window.innerHeight - 0.5);
  },
  { passive: true },
);

// ------------------------------------------------------------------- sound
// Off until the visitor asks. Volume and mute persist; enabling always needs a fresh click.

const SOUND_KEY = "event-horizon.sound.v1";
const soundEnable = $<HTMLButtonElement>("[data-sound-enable]");
const soundControls = $("[data-sound-controls]");
const soundMute = $<HTMLButtonElement>("[data-sound-mute]");
const soundVolume = $<HTMLInputElement>("[data-sound-volume]");
const soundPrefs = (() => {
  try {
    const v = JSON.parse(localStorage.getItem(SOUND_KEY) ?? "{}") as { volume?: number; muted?: boolean };
    return { volume: typeof v.volume === "number" ? v.volume : 0.7, muted: v.muted === true };
  } catch {
    return { volume: 0.7, muted: false };
  }
})();
const saveSound = () => {
  try {
    localStorage.setItem(SOUND_KEY, JSON.stringify(soundPrefs));
  } catch {
    // not critical
  }
};
soundVolume.value = String(Math.round(soundPrefs.volume * 100));

function syncSound(): void {
  soundEnable.hidden = audio.enabled;
  soundControls.hidden = !audio.enabled;
  soundMute.setAttribute("aria-pressed", String(soundPrefs.muted));
  $("[data-sound-mute-label]").textContent = soundPrefs.muted ? "Unmute" : "Mute";
  root.classList.toggle("is-sound-on", audio.enabled && !soundPrefs.muted);
}

if (!audio.available) {
  soundEnable.disabled = true;
  $("[data-sound-label]").textContent = "Sound unavailable";
}
soundEnable.addEventListener("click", async () => {
  const ok = await audio.enable();
  if (!ok) {
    soundEnable.disabled = true;
    $("[data-sound-label]").textContent = "Sound unavailable";
    return;
  }
  audio.setVolume(soundPrefs.volume);
  audio.setMuted(soundPrefs.muted);
  syncSound();
  announce(soundPrefs.muted ? "Sound enabled, muted." : "Sound on.");
  soundMute.focus({ preventScroll: true });
});
soundMute.addEventListener("click", () => {
  soundPrefs.muted = !soundPrefs.muted;
  audio.setMuted(soundPrefs.muted);
  saveSound();
  syncSound();
});
soundVolume.addEventListener("input", () => {
  soundPrefs.volume = Number(soundVolume.value) / 100;
  audio.setVolume(soundPrefs.volume);
  if (soundPrefs.muted && soundPrefs.volume > 0) {
    soundPrefs.muted = false;
    audio.setMuted(false);
  }
  saveSound();
  syncSound();
});
syncSound();

if (new URLSearchParams(location.search).has("debug")) {
  (window as unknown as { __deck: unknown }).__deck = { audio, space, cue: (c: Cue) => audio.cue(c) };
}
