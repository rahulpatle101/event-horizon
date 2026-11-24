# Day 002 — Progress (session memory)

Read this at the start of every session. Update it after every step.

## Done
- V1 (EVENT HORIZON) complete and frozen at `/` (index.html + src/). Its original brief is archived in
  `docs/day-002-v1-brief.md`. Later V1 direction docs: DESIGN.md, EXPLORER-DIRECTION.md, BLACKHOLE-REFERENCE.md.
- V2 planning: concept summary, layering decision and file structure approved (2026-11-24).
- Reference examples pulled: `ref/earth`, `ref/galaxy` (vgpu 0.6.0, revision af8ab21…).
- Task 1 (2026-11-24): static layout at `/v2/`. Files: `v2/index.html`, `v2/src/{main.ts, styles.css, layout.ts,
  countdown.ts}`, `v2/tsconfig.json`, plus the `v2` entry in `vite.config.ts`. 12-column grid, Inter Tight 400/600,
  IBM Plex Mono, tokens, HUD corners, countdown (days large, HH:MM:SS mono), inline name field, mission-brief section,
  footer, and an SVG/CSS poster (stars, Mars, dust rim, dotted transfer arc). Screenshots in `docs/screenshots/v2/`.
  Build passes. V1's 24 checks still pass.
- Task 2 (2026-11-24): particle system. `v2/src/gpu/` — renderer.ts (one Gpu/surface/frame, pause when hidden or out
  of view, device loss → poster), particles/{particles.ts, params.wgsl, simulate.wgsl, sprites.wgsl, targets.ts,
  input.ts}, post/{bright, blur (from galaxy), composite}. `v2/src/{patch.svg, settings.ts, tune.ts}`.
  Sky → patch formation with a staggered spring, pointer repel (mouse hover, touch drag), pull toward Send on hover or
  focus, temporary P toggle, ?tune with 9 controls (persisted, Copy values). Desktop 9k particles at a steady 60 fps
  (median 16.7 ms, p95 16.7 ms, headless Chrome on this Mac). Clip: docs/screenshots/v2/task2-particles.{mp4,gif}.
- Project setup: CLAUDE.md Day 002 section, the brief moved to `docs/day-002-ardent-brief.md` and updated,
  this progress file.

## Next
- V1 living deck pass: awaiting review (clip: docs/screenshots/v1-deck/living-deck-desktop.mp4).
- V3 (DOCK, `/v3/`): motion pass done and awaiting review. Clips: docs/screenshots/v3/motion-{desktop,mobile}.{mp4,gif}.
  Next (on approval): critique pass against ART_DIRECTION §13, then polish.
- Awaiting review of task 2. Then task 3: Mars grade (planet from ref/earth into the same HDR target, oxide regrade,
  dust rim, ?tune colour/rim/rotation/bloom, bloom threshold so the body never blooms, opaque output).

## Open questions
- Task 2: the canvas is transparent (premultiplied) so the poster Mars shows through. Task 3 moves the planet into the
  frame and makes the composite opaque.
- Task 2: on phones the patch forms over the Mars body (layout.ts places it at 79% height). It reads, but the wordmark
  is weaker with about 1.4k stars on oxide. Revisit the mobile patch position or size in task 4.
- Task 2: the P key and ?tune are dev aids. Remove P (or keep it behind ?tune) before task 7.
- The name field has a plain no-GPU submit (confirmation text plus an in-memory counter, no persistence), so the button
  isn't dead before task 5. Task 5 layers particles, flight, pin and localStorage on top. Is that OK?
- The mission-brief section (facts + why-a-window + footer) was added so "Read the mission brief" has a target.
  The brief lists "scroll into a mission-brief section" as a stretch. Keep it minimal like this?
- The primary button uses oxide darkened ~8% (#B03E0C) so Bone text passes AA (5.0:1; pure oxide is 4.4:1).
- Poster fallback: until the GPU scene exists (tasks 2–3), the no-GPU poster is an SVG/CSS composition.
  Replace it with a captured frame in task 7 (or the headless poster script stretch).
- `adaptive-quality` example not pulled yet. Pull it in task 6.

## Decisions log
- 2026-11-25 — URLs: V1 moved from / to /v1/ (v1/index.html, asset paths repointed ../); / is now a static variant index.
  Vite inputs: index, v1, v2, v3. Verified dev + prod: all pages load, 0 failed requests; V1 suites at /v1/: 24/24, 10/10, 98/98,
  deck 17/17, audio 14/14. reference-video/ is git-ignored (third-party recording, kept local).
- 2026-11-24 — V1 unfrozen by the user for the "Living Observation Deck" pass (V2/V3 untouched, verified by file timestamps).
  Added: src/deck/space.ts (hero stars projected through the live camera via renderer.getView(), vessel-drift dust,
  rare debris shard and HZN-R2 relay probe on paths clear of the black hole silhouette (1.15 r) and of the copy, rim
  light on the aperture, adaptive quality, pause/hidden/reduced-motion aware); src/deck/audio.ts (WebAudio-synthesised:
  cabin bed ≈ −39 dBFS, approach/settle, scan sweep + per-feature notes + chord, record latch, panned flybys; opt-in,
  mute/volume persisted, suspends when hidden); aperture + sill; radial wavefront scan with progressive reveals;
  feature selection (one sentence, others dim, photon-ring trace); record captures a plate (live WebGPU readback, poster
  fallback) that flies into the log; the log is plates only, the briefing separate. Sky: brighter, wider colour spread.
  Verified: V1 suites 24/24, 10/10, 98/98; deck 17/17; audio 14/14 (levels measured via an analyser tap, not by ear).
- 2026-11-24 — V3 motion pass: one rAF loop (SVG instrument, console, readouts, Canvas 2D stars with parallax and ≤5% twinkle);
  boot via per-layer SVG sector masks (dash-offset doesn't survive non-scaling strokes) + clip-path fill-box segment wipes;
  explicit phases boot → standby (aligning/hold) → autopilot → locked → online; vgpu warp + nebula only at lock
  (`v3/src/warp/`), with an SVG/CSS fallback from the same field. Verified: 28/28 behaviour checks (autopilot 6.01 s idle,
  ~3.3 s travel, no overshoot, 1.00 s hold, 0.60 s lock→online; keyboard; touch horizontal vs vertical; reduced motion;
  no-WebGPU; 60 fps through the warp). V1 24/24 and V2 9/9 still pass.
- 2026-11-24 — V3 touch limitation: with `pan-y`, circular drags must start on the top or bottom of the ring (recorded in the brief §11).
- 2026-11-24 — V3 static layout: `v3/{index.html, VARIANT_BRIEF.md, tsconfig.json}`, `v3/src/{main.ts, tokens.css, styles.css,
  station.ts, console.ts, starfield.ts}`. Station + console are SVG generated in code (station in a -320..320
  viewBox with non-scaling 1px strokes; console at real pixel size). Starfield is Canvas 2D and skips text areas.
  Console colours are limited to apricot + periwinkle + amber. Contrast: all text 6.5–16.6:1. `?state=online` previews the
  final state (also the reduced-motion resting state). Gotcha: `.station rect { fill: none }` emptied the grid's
  `<mask>` rect; stroke rules now exclude `defs *`.
- 2026-11-24 — V3 chosen: concept 1, DOCK ("Thread the needle"), from ART_DIRECTION_space-station.md. No UPLINK.
  Build at /v3/. The user approved a third vite.config.ts entry. Added to the brief at the user's request: affordance
  (DRAG TO ALIGN + code, rotate cursor, pulsing offset arrow), autopilot after 6 s idle, magnetic assist ±3°, 1 s hold
  segment fill, console-boot handoff of the headline + CTA after ONLINE, Replay, reduced-motion static final state.
- 2026-11-24 — The Pinterest board itself can't be read by automated fetch (it's behind a login/JS shell). The art
  direction file describes its 11 pins and is the source of truth.
- 2026-11-24 — One Gpu, one surface, one frame. Planet → shared HDR target → particles (compute + additive
  instanced quads) into the same target → one bloom chain → one composite/grade. No second canvas.
  Reason: particle light must add over Mars, and one bloom chain instead of two.
  Docs confirm multi-surface support and premultiplied canvases (not used).
- 2026-11-24 — Bloom threshold: only the atmosphere rim, particles and pin bloom. The Mars body never blooms.
- 2026-11-24 — The particle sim is rewritten around a swappable target buffer (sky → patch → arc → name → point) with
  springs. The galaxy's quad renderer, bloom and pointer input are reused. The galaxy example has no target buffer
  (stars flow on fixed strokes), so its sim core cannot be reused as-is.
- 2026-11-24 — Particle budget: about 8–10k on desktop, about 2k on mobile, 1,500 for the name (tuning start point).
- 2026-11-24 — Task order: particles (2) before the Mars grade (3).
- 2026-11-24 — Countdown target 20 Nov 2028. Days are the hero ("726 DAYS"), with HH:MM:SS small in mono.
- 2026-11-24 — Counter: a seeded number plus this visitor's launches (no backend). Footer: "Fictional mission
  concept. Not affiliated with NASA."
- 2026-11-24 — ?tune panel from plain inputs (no lil-gui).
- 2026-11-24 — Environment check is `npx vgpu doctor` (healthy on this machine: Apple Metal).
- 2026-11-24 — V2 typechecks with its own `v2/tsconfig.json` (extends root) because the root tsconfig is shared/V1.
  Run `npx tsc --noEmit -p v2/tsconfig.json`. `npm run build` does not typecheck V2.
- 2026-11-24 — Scene geometry lives in `v2/src/layout.ts` (planet circle, arc Bézier, landing point) and is mirrored
  in CSS (`svh` units), so the GPU layer can reuse the same numbers.
- 2026-11-24 — Particle feel defaults: stiffness 14, damping 6 (ζ≈0.8, slight overshoot), repel 110 px / 2600,
  pull 240 px / 900, 9000 particles desktop (×0.22 on phones ≈ 2k), 72% of them form the patch, speed cap 1800 px/s.
  Repel was first 9000 and shredded the patch (equilibrium displacement ≈ strength/stiffness ≈ 640 px).
- 2026-11-24 — Stars bound for a shape wait dim (×0.32) and ignite as they assemble, so the pre-formation sky stays
  quiet. Sky stars are hidden inside the planet disc and dimmed 72% behind the copy and countdown.
- 2026-11-24 — patch.svg text is drawn with canvas fillText in Inter Tight (SVG-as-image can't load web fonts);
  shapes go through the SVG image. Particles are paired with points by angle around the patch centre.
- 2026-11-24 — V1 brief archived to `docs/day-002-v1-brief.md` before CLAUDE.md was replaced. `ardent-brief.md` moved
  to `docs/day-002-ardent-brief.md`.
- 2026-11-24 — V2 build: Vite multi-page, with a `v2` entry in `vite.config.ts` via `build.rolldownOptions.input`
  (Vite 8 deprecates `rollupOptions`).
