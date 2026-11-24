import "@fontsource-variable/inter-tight/wght.css";
import "@fontsource/ibm-plex-mono/latin-400.css";
import "./styles.css";

import { remaining } from "./countdown.ts";
import type { Renderer } from "./gpu/renderer.ts";
import { MOBILE_QUERY, sceneGeometry } from "./layout.ts";
import { loadFeel, mountTunePanel } from "./tune.ts";

const $ = <T extends Element = HTMLElement>(selector: string) => {
  const el = document.querySelector<T>(selector);
  if (!el) throw new Error(`Missing element: ${selector}`);
  return el;
};

const mobileQuery = matchMedia(MOBILE_QUERY);
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");

// ------------------------------------------------------------- countdown

const daysEl = $("[data-days]");
const clockEl = $("[data-clock]");

function tick(): void {
  const r = remaining();
  daysEl.textContent = r.days.toLocaleString("en-US");
  clockEl.textContent = r.open ? "Window open" : r.clock;
}
tick();
// Align ticks to the second boundary so the clock never skips a digit.
window.setTimeout(() => {
  tick();
  window.setInterval(tick, 1000);
}, 1000 - (Date.now() % 1000));

// ------------------------------------------------------- transfer arc (poster)

const arcSvg = $<SVGSVGElement>("[data-arc]");
const arcPath = $<SVGPathElement>("[data-arc-path]");

function drawArc(): void {
  const width = window.innerWidth;
  const height = window.innerHeight; // matches the svh units in styles.css
  const { arc } = sceneGeometry(width, height, mobileQuery.matches);
  arcSvg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  const f = (p: [number, number]) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`;
  arcPath.setAttribute("d", `M ${f(arc.p0)} C ${f(arc.c1)}, ${f(arc.c2)}, ${f(arc.p3)}`);
}
drawArc();
window.addEventListener("resize", drawArc, { passive: true });
mobileQuery.addEventListener("change", drawArc);

// ------------------------------------------------- send your name (static path)
// Task 1 wires the plain-HTML flow only, so no control is dead. Task 5 adds the
// particle assembly, flight, landing pin and persistence on top of this.

const openButton = $<HTMLButtonElement>("[data-send-open]");
const form = $<HTMLFormElement>("[data-send-form]");
const input = $<HTMLInputElement>("[data-send-input]");
const submit = $<HTMLButtonElement>("[data-send-submit]");
const cancel = $<HTMLButtonElement>("[data-send-cancel]");
const count = $("[data-send-count]");
const done = $("[data-send-done]");
const names = $("[data-names]");
const announcer = $("[data-announcer]");

const SEEDED_NAMES = 12408;
let launches = 0;

function syncInput(): void {
  const value = input.value.trim();
  submit.disabled = value.length === 0;
  const left = 20 - input.value.length;
  count.textContent = left === 20 ? "20 characters max" : `${left} characters left`;
}

function openForm(): void {
  form.hidden = false;
  openButton.hidden = true;
  openButton.setAttribute("aria-expanded", "true");
  syncInput();
  input.focus();
}

function closeForm(): void {
  form.hidden = true;
  openButton.hidden = false;
  openButton.setAttribute("aria-expanded", "false");
  openButton.focus();
}

openButton.addEventListener("click", openForm);
cancel.addEventListener("click", closeForm);
input.addEventListener("input", syncInput);
form.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    event.preventDefault();
    closeForm();
  }
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const name = input.value.trim();
  if (!name) return;
  launches += 1;
  names.textContent = (SEEDED_NAMES + launches).toLocaleString("en-US");
  form.hidden = true;
  done.hidden = false;
  done.textContent = `${name}, your name flies with ARDENT.`;
  openButton.hidden = false;
  openButton.textContent = "Send another name";
  openButton.setAttribute("aria-expanded", "false");
  input.value = "";
  openButton.focus();
  announcer.textContent = "Your name has been added to the ARDENT manifest.";
});

// ------------------------------------------------------------ brief link

$("[data-brief-link]").addEventListener("click", (event) => {
  event.preventDefault();
  const brief = $("#brief");
  brief.scrollIntoView({ behavior: reducedMotion.matches ? "auto" : "smooth" });
  brief.focus({ preventScroll: true });
  history.replaceState(null, "", "#brief");
});

// ------------------------------------------------------- particle layer (GPU)
// The page above never waits for this. Without WebGPU the poster simply stays.

const root = document.documentElement;
const feel = loadFeel();
let renderer: Renderer | undefined;

const INTRO_DELAY_MS = 1200; // stars drift in the void, then form the patch

void import("./gpu/renderer.ts")
  .then(({ createRenderer }) => {
    renderer = createRenderer({
      canvas: $<HTMLCanvasElement>("[data-canvas]"),
      feel,
      pullTarget: openButton,
      quiet: [$(".hero__copy"), $(".countdown")],
      reducedMotion: reducedMotion.matches,
      onLive() {
        root.classList.add("is-live");
        window.setTimeout(() => renderer?.setFormed(true), reducedMotion.matches ? 0 : INTRO_DELAY_MS);
      },
      onFailure(reason, error) {
        root.classList.add("is-fallback");
        console.warn(`[ardent] particle layer unavailable (${reason})`, error);
      },
    });
  })
  .catch((error: unknown) => console.warn("[ardent] renderer failed to load", error));

// Temporary (task 2): P toggles sky ↔ patch so the formation can be replayed.
document.addEventListener("keydown", (event) => {
  if (event.key !== "p" && event.key !== "P") return;
  if (event.metaKey || event.ctrlKey || event.altKey) return;
  if ((event.target as HTMLElement | null)?.closest("input, textarea, [contenteditable]")) return;
  renderer?.setFormed(!renderer.formed);
});

mountTunePanel(feel, {
  rebuild: () => renderer?.rebuild(),
  replay: () => {
    if (!renderer) return;
    renderer.setFormed(false);
    window.setTimeout(() => renderer?.setFormed(true), 900);
  },
});
