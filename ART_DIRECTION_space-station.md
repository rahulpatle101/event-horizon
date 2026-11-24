# ART DIRECTION — "SPACE STATION"
**100 Days of Digital Craft** · Art direction for Claude Code
**Source mood board:** Pinterest — "Space station" (11 pins) · https://pin.it/1f8XG5nj3
**Version:** 1.0 · 2026-11-24

> **How to use this file:** Read it fully before writing any UI code. Every visual and motion decision should be traceable to a rule here. If a rule conflicts with a mission brief, the brief wins on *what* to build and this file wins on *how it looks and moves*. When unsure, choose restraint.

---

## 1. The idea in one line

**A quiet ship computer floating in a very large dark.**
Precise line-drawn instruments sit on an endless black void, framed by warm, color-blocked console panels from a 1990s idea of the future. Calm, competent, a little nostalgic. Never noisy and never "gamer RGB."

**Mood words:** vast · precise · warm-retro · calm-operational · analog-future · mission-ready
**Anti-mood:** cyberpunk neon, glassmorphism, generic SaaS dashboard, stock "space" gradients, glowing purple AI blobs

---

## 2. What the board actually contains (reference breakdown)

| # | Pin | What to take from it |
|---|-----|----------------------|
| 1 | Teal pixel planet with voxel debris on deep navy | One **playful accent** allowed per screen; chunky pixel detail against a calm field |
| 2 | Technical orbital line drawing on charcoal | **Hairline instruments**: arcs, ticks, tiny labels, overlapping circles, engineering annotation |
| 3 | Blue-glow orrery / solar system | Concentric orbits, a single light source, **depth with very little color** |
| 4 | Tiny starship + small caption on a huge starfield | **Extreme negative space**; small, quiet typography; scale tells the story |
| 5 | Wireframe planet with orbit rings + crosshair axes on black | **Diagram as hero**: centered, symmetric, crosshair registration marks |
| 6 | Monochrome black hole with concentric line accretion disc | **Line density as shading**; flares as the only bright moment |
| 7 | Color-blocked retro ship-computer panel reading "STANDBY" | **Console frame language**: rounded elbow bars, pill segments, numeric codes, condensed caps, pastel/amber palette |
| 8 | Ship corridor: cream light panels, beige walls, navy carpet | **Interior warmth**: soft diffused cream light, rounded architecture, calm 90s material palette |
| 9 | Bridge console facing a starfield window | **Framing device**: UI as a window looking *out* at space |
| 10 | Ring-shaped space station on starfield | **Mechanical radial symmetry**; structures built from rings and spokes |
| 11 | Nebula seen through a warped spatial grid | **The one burst of color**: orange/blue nebula behind a grid that bends |

**Synthesis — four layers, always in this order (back to front):**
1. **VOID**: black, stars, vast empty space (pins 3, 4, 10)
2. **INSTRUMENT**: hairline diagrams, orbits, grids, annotations (pins 2, 5, 6, 11)
3. **CONSOLE**: color-blocked rounded panels and readouts (pin 7, 9)
4. **WARMTH**: soft cream light and rounded interior forms used for surfaces and glows (pin 8)

---

## 3. Originality guardrail (important)

The board includes stills and interface art from an existing sci-fi franchise. **We borrow the era and the grammar, not the property.**

- ❌ Do not reproduce that franchise's interface system name, logos, insignia, ship or station designs, character likenesses, catchphrases or exact panel layouts.
- ❌ Do not use the "STANDBY" panel as a template to trace. Rebuild the *idea* (elbow bars + pill segments + codes) with our own proportions, palette shifts and naming.
- ✅ Invent our own ship/station name, call signs, codes and labels (see §9 for naming).
- ✅ Test: a fan should feel "90s ship computer," but nobody should be able to name the show from a screenshot.

---

## 4. Color

### 4.1 Ratio (enforce it)
**70% Void · 20% Instrument line · 8% Console color · 2% Nebula/accent**
If a screen feels colorful, it's wrong. Color is earned and appears in *panels and signals*, not backgrounds.

### 4.2 Tokens

```css
:root {
  /* VOID */
  --void-0: #050608;   /* page background, true deep space */
  --void-1: #0D0F13;   /* instrument plate / card bg (charcoal from pin 2) */
  --void-2: #171A20;   /* raised surface, hover plate */
  --void-3: #242832;   /* dividers on dark */

  /* INSTRUMENT (lines + text on dark) */
  --line-hi:  #ECE8DF; /* starlight white, primary hairlines + display text */
  --line-mid: #9A9EA6; /* secondary lines, labels */
  --line-lo:  #4A4F59; /* grids, ticks, tertiary */

  /* CONSOLE (color-block panels; never as page bg) */
  --c-amber:    #FFB23F; /* primary signal, headline readouts */
  --c-apricot:  #F29A5C; /* elbows, primary bars */
  --c-peach:    #F4C7A4; /* secondary bars */
  --c-lilac:    #A898D8; /* secondary panels */
  --c-periwink: #8DA4E6; /* data/nav panels */
  --c-rose:     #D77A8C; /* tertiary panels */
  --c-alert:    #E2483C; /* alerts only, never decorative */

  /* WARMTH (interior light) */
  --w-cream: #F3EBD3;  /* diffused light panels, soft glows */
  --w-taupe: #B8AD98;  /* rounded structural surfaces */
  --w-navy:  #1E3253;  /* deep carpet blue, grounding blocks */

  /* NEBULA (2% max; one moment per screen) */
  --n-ion:    #3B7BFF;
  --n-plasma: #FF7A2F;
  --n-teal:   #5FD3B5; /* playful planet accent (pin 1) */
}
```

### 4.3 Rules
- Background is always `--void-0`. No gradients on the page background except a *very* subtle radial vignette (≤ 6% lift).
- Hairlines use `--line-*`, never console colors. Console colors are **filled blocks**, not strokes.
- Max **3 console colors** visible at once. Amber + one cool (lilac/periwinkle) + one warm (apricot/peach/rose) is the default triad.
- Glows: use `--w-cream` or `--n-ion` at low opacity (box-shadow / bloom), never saturated neon.
- Text on console blocks is `--void-0` (dark on light), never white.
- Contrast: body text ≥ 4.5:1, readouts ≥ 3:1 at their large size. Verify.

---

## 5. Typography

| Role | Font (Google Fonts, free) | Style |
|------|---------------------------|-------|
| **Display / readouts** | **Antonio** (600–700) | UPPERCASE, condensed, tracking `0.04em`, tight leading `0.95` |
| **Data / labels / codes** | **JetBrains Mono** (400–500) | UPPERCASE, 10–12px, tracking `0.08em` |
| **Body (rare)** | **IBM Plex Sans Condensed** (400) | Sentence case, 15–16px, leading 1.5 |

**Scale (px):** 10 · 12 · 14 · 16 · 24 · 40 · 72 · 128
**Rules**
- Display type sits **inside** console blocks or **alone in the void**. Never both on one element.
- Big type is rare. One headline readout per view (e.g., `STANDBY`, `ORBIT 04`, `ONLINE`).
- Labels always pair a **code + word**: `26-4 · TELEMETRY`, `007 · DOCKING`. Codes are numeric, 2–4 digits, hyphenated.
- Micro-annotations on diagrams: 9–10px mono, `--line-mid`, placed on leader lines with a 4px gap.
- Small captions in vast space (pin 4): 11px mono, centered, `--line-mid`, lots of air.

---

## 6. Layout & composition

- **Grid:** 12 columns, 24px gutters, 8px base unit. Console geometry snaps to 8px.
- **Hero composition:** one centered instrument (planet / orbit / station) on the void, crosshair registration lines extending to the viewport edges at `--line-lo`. Console frame occupies **one edge or one corner**, never all four.
- **Negative space:** at least **55% of any hero viewport** is empty void. If it feels empty, it's probably right.
- **Window framing:** UI can act as the bridge window: console frame on left + bottom, space visible through the rest.
- **Symmetry:** instruments are radially symmetric; consoles are asymmetric (L-shapes, elbows). That tension is the look.
- **Density gradient:** dense detail at the edges (console, codes), sparse at the center (void and one object).

---

## 7. Component vocabulary

### 7.1 Console frame ("elbow")
- An L-shaped bar: vertical bar (width 96–120px) meeting a horizontal bar (height 24–32px) with an **outer radius = bar width / 2** and a **smaller inner radius (16–24px)**.
- Horizontal bars are split into **segments** separated by 4px gaps of `--void-0`. Segments have varied lengths (rhythm: long, short, short, long).
- Bars end in **half-pill caps**.
- Labels sit right-aligned inside segments, dark text, mono 10–12px.

### 7.2 Pill buttons
- Height 32/40px, fully rounded ends, filled console color, dark uppercase label.
- Hover: color steps one notch lighter + 2px cream inner glow. Press: drop 1px + darken 8%.
- Optional square-end variant for the side of a pill that touches a frame.

### 7.3 Readout block
- Large Antonio numeral or word in `--c-amber` on void, with a mono code above it and a thin `--line-lo` rule below.
- Numbers tick (see motion). Units in mono, 40% size, baseline-aligned.

### 7.4 Instrument / diagram (SVG or Canvas)
- Stroke `1px` (`0.75px` on high-DPI), `--line-hi` primary, `--line-mid` secondary.
- Ingredients: concentric circles, partial arcs, tick rings (every 5°/15°), crosshair axes, dashed orbits (`2 6`), small filled dots as bodies, leader lines with labels.
- Shading via **line density** (pin 6), never via gradients.

### 7.5 Starfield
- 3 parallax layers; star sizes 0.5 / 1 / 1.5px; 90% `--line-hi` at 40–90% opacity, 10% faint warm/cool tints.
- Density: sparse. No twinkling on more than ~5% of stars.

### 7.6 The playful accent (optional, max one)
- A small pixel/voxel object (pin 1): a teal planet, a debris cluster, a tiny probe. Pixel-crisp (`image-rendering: pixelated`), drifting slowly. This is the wink; use only one.

---

## 8. Motion

**Personality:** calm, mechanical, deliberate. Things *boot*, *align*, *orbit*. Nothing bounces, wobbles or overshoots.

| Token | Value | Use |
|-------|-------|-----|
| `--ease-system` | `cubic-bezier(0.2, 0, 0, 1)` | Default for panels, reveals |
| `--ease-orbit` | `linear` | Rotations, drifts |
| `--ease-signal` | `cubic-bezier(0.4, 0, 0.6, 1)` | Pulses, blinks |
| `--t-fast` | 120ms | Hover, press |
| `--t-base` | 280ms | Panel segments, state changes |
| `--t-slow` | 640ms | Hero reveals |
| Orbit periods | 60s / 120s / 240s | Background bodies; never faster than 30s |

**Motion patterns**
1. **Boot sequence:** segments of console bars wipe in left→right, staggered 40ms each, `--t-base`.
2. **Line draw:** diagrams draw on via `stroke-dashoffset`, outer ring first, then inner, then labels fade in (stagger 60ms).
3. **Readout tick:** numbers count up with a mono "scramble" for the last 200ms. Never longer than 900ms.
4. **Standby pulse:** signal text and one segment breathe opacity 1 → 0.45 → 1 over 1.6s, `--ease-signal`.
5. **Parallax:** pointer moves starfield layers ±4 / ±8 / ±14px. Instruments stay stable (they're the anchor).
6. **Grid warp (signature, optional):** the spatial grid (pin 11) bends gently around the cursor or a focal body; nebula color appears only *inside* the warp.

**Reduced motion:** respect `prefers-reduced-motion`: no parallax, no orbits, instant boots, a static standby state.

---

## 9. Voice, naming & microcopy

- Tone: terse mission-control. Labels, not sentences.
- Format: `CODE · NOUN` → `04-11 · ORBITAL`, `12 · POWER`, `318 · UPLINK`.
- States: `STANDBY` → `ALIGNING` → `ONLINE`; `NOMINAL`, `DRIFT`, `HOLD`, `LOCKED`.
- Invent an original station/vessel name per project (e.g., *Halcyon Ring*, *Station Kestrel-9*, *Outpost Lumen*). Never borrow from existing franchises.
- Captions in the void can be poetic but short (≤ 6 words), small mono, centered.

---

## 10. Signature moment (default)

**"Standby → Online."**
1. Pure black. A single dim crosshair.
2. One orbit ring draws itself around the center.
3. Console elbow slides in from the left edge, segments booting one by one.
4. Readouts tick to their values; `STANDBY` pulses in amber.
5. On first user interaction, the grid behind the planet warps, a brief nebula bloom appears inside it, and `STANDBY` flips to `ONLINE` with one segment turning periwinkle.

Total ≤ 3.5s, skippable, replayable.

---

## 11. Rendering & tech hints for Claude Code

- **SVG** for instruments, diagrams and console frames (crisp, animatable, accessible).
- **Canvas 2D** for starfields (> 300 particles).
- **WebGL / Three.js / shaders** only for the grid warp, nebula and black-hole line effects; keep a static fallback.
- Fonts via Google Fonts with `font-display: swap`; preload Antonio.
- Use CSS custom properties from §4.2 and §8; no hard-coded hex values in components.
- Hairlines: use `vector-effect: non-scaling-stroke` on SVG.
- Target 60fps; pause animation when tab hidden; cap DPR at 2 for canvas.

---

## 12. Do / Don't

**Do**
- Let the void breathe. One hero object per view.
- Draw with hairlines; fill with flat console color.
- Pair every label with a numeric code.
- Make motion feel like systems booting and aligning.
- Keep color for panels and signals.

**Don't**
- Gradient page backgrounds, glassmorphism, blur cards, neon glows.
- Rounded "SaaS cards" with drop shadows.
- Emoji, icon-library icons (draw custom glyphs from circles, arcs and ticks instead).
- More than 3 console colors at once, or console colors as strokes.
- Bouncy/spring easing, fast spins, constant twinkling.
- Anything recognizable as a specific franchise's UI, logos or ships.

---

## 13. Critique checklist (run before calling it done)

- [ ] ≥ 55% void in the hero; color ratio roughly 70/20/8/2
- [ ] Only tokens from this file are used; no stray hex values
- [ ] Antonio for display, JetBrains Mono for data, and nothing else sneaking in
- [ ] Every label has a code; microcopy is terse
- [ ] Console frame uses elbows + segmented bars + pill caps, on one edge or corner only
- [ ] Diagrams are hairline, symmetric, annotated with leader lines
- [ ] Motion uses the defined easings; no overshoot; reduced-motion handled
- [ ] Signature moment plays ≤ 3.5s and is skippable
- [ ] Contrast checked; keyboard focus visible (2px cream outline, 2px offset)
- [ ] Originality test: you can't name the source show from a screenshot
- [ ] It looks good as a single still frame (portfolio screenshot test)

---

## 14. Prompt snippets for Claude Code

**Kickoff**
> Read `ART_DIRECTION_space-station.md` fully. Summarize the four layers, the color ratio, the fonts, and the signature moment in 6 bullets before writing code. Then build only the static layout with tokens, no motion yet.

**Motion pass**
> Add motion per §8 and the signature moment per §10. Use only the motion tokens. Implement `prefers-reduced-motion`. Don't change layout.

**Critique pass**
> Act as a senior art director. Screenshot the result and score it against the §13 checklist. List the 5 biggest deviations from the art direction with the exact fix for each, then apply them.

**Drift check (use whenever output starts feeling generic)**
> Compare the current UI to §1 mood and §12 Don'ts. What has drifted toward generic SaaS or neon sci-fi? Revert those choices.
