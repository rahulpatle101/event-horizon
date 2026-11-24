// ?tune panel: plain inputs for the particle feel. Dev aid, shown only with ?tune in the URL.
// Values persist in localStorage so a tuning session survives reloads; "Copy values" exports JSON.
import { DEFAULT_FEEL, type ParticleFeel } from "./settings.ts";

const KEY = "ardent.tune.v1";

interface Control {
  key: keyof ParticleFeel;
  label: string;
  min: number;
  max: number;
  step: number;
  /** Needs a particle rebuild rather than a live update. */
  rebuild?: boolean;
}

const CONTROLS: Control[] = [
  { key: "stiffness", label: "Spring stiffness", min: 2, max: 60, step: 0.5 },
  { key: "damping", label: "Spring damping", min: 0.5, max: 20, step: 0.1 },
  { key: "repelRadius", label: "Repel radius (px)", min: 20, max: 320, step: 5 },
  { key: "repelStrength", label: "Repel strength", min: 0, max: 30000, step: 250 },
  { key: "pullRadius", label: "Button pull radius (px)", min: 40, max: 500, step: 10 },
  { key: "pullStrength", label: "Button pull strength", min: 0, max: 4000, step: 50 },
  { key: "count", label: "Particles (desktop)", min: 1000, max: 20000, step: 500, rebuild: true },
  { key: "size", label: "Particle size", min: 0.4, max: 3, step: 0.05 },
  { key: "glow", label: "Glow (bloom)", min: 0, max: 3, step: 0.05 },
];

export function loadFeel(): ParticleFeel {
  const feel = { ...DEFAULT_FEEL };
  if (!new URLSearchParams(location.search).has("tune")) return feel;
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Partial<ParticleFeel>;
    for (const c of CONTROLS) {
      const v = saved[c.key];
      if (typeof v === "number" && Number.isFinite(v)) feel[c.key] = Math.min(c.max, Math.max(c.min, v));
    }
  } catch {
    // Storage unavailable or corrupt: defaults.
  }
  return feel;
}

export function mountTunePanel(
  feel: ParticleFeel,
  actions: { rebuild(): void; replay(): void },
): void {
  if (!new URLSearchParams(location.search).has("tune")) return;
  const panel = document.createElement("aside");
  panel.className = "tune";
  panel.setAttribute("aria-label", "Tuning panel");
  const title = document.createElement("p");
  title.className = "tune__title";
  title.textContent = "?tune · particles";
  panel.append(title);

  let rebuildTimer = 0;
  const save = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify(feel));
    } catch {
      // Not critical.
    }
  };
  const outputs = new Map<keyof ParticleFeel, { input: HTMLInputElement; out: HTMLOutputElement }>();

  for (const c of CONTROLS) {
    const row = document.createElement("label");
    row.className = "tune__row";
    const name = document.createElement("span");
    name.textContent = c.label;
    const out = document.createElement("output");
    const input = document.createElement("input");
    input.type = "range";
    input.min = String(c.min);
    input.max = String(c.max);
    input.step = String(c.step);
    input.value = String(feel[c.key]);
    out.value = String(feel[c.key]);
    input.addEventListener("input", () => {
      feel[c.key] = Number(input.value);
      out.value = input.value;
      save();
      if (c.rebuild) {
        window.clearTimeout(rebuildTimer);
        rebuildTimer = window.setTimeout(actions.rebuild, 300);
      }
    });
    row.append(name, out, input);
    panel.append(row);
    outputs.set(c.key, { input, out });
  }

  const buttons = document.createElement("div");
  buttons.className = "tune__buttons";
  const button = (label: string, onClick: () => void) => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = label;
    b.addEventListener("click", onClick);
    buttons.append(b);
  };
  button("Replay (P)", actions.replay);
  button("Reset", () => {
    const countChanged = feel.count !== DEFAULT_FEEL.count;
    Object.assign(feel, DEFAULT_FEEL);
    for (const [key, { input, out }] of outputs) {
      input.value = String(feel[key]);
      out.value = String(feel[key]);
    }
    save();
    if (countChanged) actions.rebuild();
  });
  button("Copy values", () => {
    void navigator.clipboard?.writeText(JSON.stringify(feel, null, 2));
  });
  panel.append(buttons);
  document.body.append(panel);
}
