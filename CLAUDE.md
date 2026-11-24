## Day 002 — NASA mission hero (vgpu)

### Variants
- V1: v1/index.html + src/ at /v1/. FROZEN. Never edit V1 files unless I ask.
- Root index.html (/) is a variant index linking /v1/, /v2/, /v3/ (no app code).
- V2 (ARDENT: Through the Red Window): v2/ at /v2/. The only shared edit
  allowed is the second entry in vite.config.ts.
- V3 (DOCK: Thread the needle): v3/ at /v3/. Brief: v3/VARIANT_BRIEF.md;
  art direction: ART_DIRECTION_space-station.md (read both before any V3 work).
  The only shared edit allowed is the third entry in vite.config.ts.
- Source of truth: docs/day-002-ardent-brief.md. Read it before any V2 work.
- Session memory: docs/day-002-progress.md. Read it at the start of every
  session and update it after every step (done / next / open questions).
- If the brief, this file and my chat instructions conflict, ask me which wins.

### Locked decisions (V2)
- Rendering: one Gpu, one surface, one frame. Planet passes write into a
  shared HDR target, then particles (compute + additive instanced quads)
  draw into the same target, then one bloom chain, then one composite/grade.
  No second canvas.
- Bloom threshold: only the atmosphere rim, particles and pin bloom. The
  Mars body never blooms.
- Particles: the sim is rewritten around a swappable target buffer
  (sky → patch → arc → name → point). Springs, not tweens. Reuse the galaxy
  quad renderer, bloom and pointer input. About 8–10k particles on desktop
  and about 2k on mobile (tuning start point); 1,500 peel off for the name.
- Planet: from ref/earth. No ocean, night lights or clouds; oxide albedo;
  thin dust rim; slow rotation; pin spot at a lat/long.
- Page layer: headline, countdown, button, field and HUD are plain HTML,
  never inside the canvas.
- Countdown: target 20 Nov 2028. Days are the hero ("726 DAYS", large),
  with HH:MM:SS small in mono below.
- Counter: a seeded number plus this visitor's launches (no backend).
  Footer reads: "Fictional mission concept. Not affiliated with NASA."
- Tuning: a ?tune panel built from plain inputs (no lil-gui) for colour,
  rim, rotation and bloom.
- vgpu: use npx vgpu docs / the MCP for every API question; never guess.
  Environment check is npx vgpu doctor. Reference examples: earth,
  spiral-galaxy, adaptive-quality.

### Design tokens (V2)
Void #07070A · Oxide #C1440E · Dust #E8B48A · Bone #F2EDE4 · Ash #8A857D
Inter Tight (2 weights, caps, wide tracking) · IBM Plex Mono (11–12px, uppercase)
Motion: heavy and slow, one thing moves at a time, no bounce on type.

### V2 build tasks (one per turn; stop for my review after each)
- [x] 1. Static layout (~45 min): grid, type, copy, HUD, countdown, footer,
      poster fallback. It must look finished with no GPU.
- [x] 2. Particle system: rewritten sim with a swappable target buffer;
      sky → patch from patch.svg; pointer repel; hover pull toward the button.
- [ ] 3. Mars grade: planet from earth, oxide regrade, dust rim, ?tune
      panel, bloom threshold.
- [ ] 4. Intro acts: patch → arc → Mars reveal, under 5 s, skip on
      scroll/click, start at Act 3 on return within 24 h.
- [ ] 5. Send your name: inline field → assemble → hold → collapse → fly
      the arc → land → pin persists (localStorage) → counter +1 →
      button state.
- [ ] 6. Hardening: keyboard flow, aria-live, reduced motion, no-WebGPU
      poster path, adaptive quality, DPR cap, pause when hidden or out of
      view, device loss, mobile layout.
- [ ] 7. Polish: timing pass, poster screenshot, 10-second clip.
- [ ] Stretch: sound, scroll into a mission-brief section, share card,
      headless poster script.

### Definition of done (per step)
Show me the result (screenshot or running URL), list what changed, flag
anything that deviates from the brief, then tick the box and update progress.
