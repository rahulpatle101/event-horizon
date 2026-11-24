# DAY 002 / 100 — EVENT HORIZON

A cinematic landing-page hero for **EVENT HORIZON**, a *fictional* robotic mission concept to observe a
black hole from outside its event horizon. The black hole is rendered live in the browser with
[vgpu](https://github.com/vercel-labs/vgpu) on WebGPU: real gravitational lensing, a dark shadow, a
Doppler-brightened accretion disk, a photon ring, and HDR bloom.

> Not an actual NASA mission. All mission details, distances, and telemetry are illustrative.

## Run it

```sh
npm install
npm run dev       # http://localhost:5173/
npm run build     # typecheck (V1) + production build → dist/
npm run preview   # serve dist/ locally
npm run poster    # re-render V1's fallback posters from the real shader (needs a GPU in Node)
```

| URL | What |
| --- | --- |
| `/` | Variant index |
| `/v1/` | **V1 · EVENT HORIZON**: living observation deck (this README describes V1 in detail) |
| `/v2/` | **V2 · ARDENT**: Mars mission, stardust patch (in progress; brief in `docs/day-002-ardent-brief.md`) |
| `/v3/` | **V3 · DOCK**: Tessaly Ring docking (brief in `v3/VARIANT_BRIEF.md`) |

The live renders need a WebGPU browser (recent Chrome or Edge). Without WebGPU, each variant falls back to a static
scene and keeps working. V2 and V3 typecheck separately: `npx tsc --noEmit -p v2/tsconfig.json` and `-p v3/tsconfig.json`.

Requires Node 22.6+ (the poster script uses Node's built-in TypeScript type stripping; developed on Node 24).

## What's here

```
v1/index.html               V1 page: hero, encounter console, log/briefing dialog, sound controls
index.html                  variant index (/), links to /v1/, /v2/, /v3/
src/main.ts                 UI state: briefing, observation mode, pause, fallback, lifecycle
src/styles.css              art direction, layout, motion, reduced-motion
src/blackhole/              renderer adapted from vgpu's "optimized-black-hole" example
  *.wgsl                    upstream shaders (composite.wgsl modified, see below)
  pipeline.ts               multi-pass chain: bake → refine → shade → 3-level bloom → composite
  renderer.ts               browser lifecycle, quality scaling, pause, framing, device loss
  settings.ts               look settings + hero / mobile / observation framings
scripts/render-poster.ts    headless Node render of the same pipeline → fallback posters
public/                     posters, favicon, licenses.txt
reference/, ref/            untouched downloads of vgpu examples (MIT) used as starting points
v2/, v3/                    the other two variants (own index.html, src/, tsconfig.json)
src/deck/                   V1 living deck: space.ts (stars, dust, encounters, rim light), audio.ts (opt-in WebAudio)
```

### How it was adapted from the example

The upstream example was pulled with `npx vgpu examples pull optimized-black-hole --out ./reference`
(vgpu 0.6.0). Changes:

- **Color.** The upstream composite pass hard-codes `SATURATION = 0.0`, so its output is grayscale. Saturation
  and a highlight warmth grade are now uniforms (`params.y`, `params.z`), which brings out the disk's amber-white thermal colors.
- **Quiet sky.** The field and dust star layers are dimmed in `stars.wgsl`, overall star brightness is 0.55,
  and `shade.wgsl` applies a soft elliptical attenuation to stars (never the disk) behind the copy. The mask is set
  per framing (`copyMask`). Bloom strength is 0.8, which keeps disk texture visible near the brightest edge.
- **Framing.** Three camera presets: an asymmetric desktop hero with the shadow at the right and copy on the left, a mobile
  framing with the hole in the upper third, and a centered observation framing. Changing framing re-runs the
  one-shot geodesic bake, and a 340 ms fade to black hides that one-frame bake.
- **Shared pipeline.** Shaders are injected into `pipeline.ts`, so the browser (Vite loader) and the
  Node poster script (`resolveShader`) render exactly the same chain.
- **Lifecycle.** Pause/resume renders frames only on demand. Reduced-motion starts paused. Render scale adapts
  (DPR cap 1.75 on desktop and 1.5 on mobile, a pixel budget, and up to two quality steps down when the median frame time is over 24 ms). GPU targets are
  reallocated only on resize or a quality change. Rendering stops while the tab is hidden. Device loss and
  init failures switch to the fallback, and a 9 s watchdog prevents an endless loading state.

### Fallback

The static posters are rendered headless from the real shader, with the same framing and time as the
live view's first frame. They also act as the loading layer: the live canvas crossfades in over the poster, and
`object-position` keeps the shadow aligned at every aspect ratio. Without WebGPU the page keeps its full
composition, text, briefing, and observation mode. The pause control is hidden because nothing animates,
and the footer explains why.

## Black hole look (BLACKHOLE-REFERENCE.md)

Tuned from `reference-video/blackhole-reference.mov`. Only the rendering qualities were borrowed:

- **Silky silver disk with a warm ivory core.** Long angular streaks, fine radial bands, low turbulence
  (`settings.ts` disk look). The thermal ramp in `disk.wgsl` runs from cool grey to silver-white and warms only at the hottest radii. The approaching side gets a faint cool cast.
- **Chromatic fringe.** `composite.wgsl` splits RGB radially around the shadow centre, fading out away from the hole so stars stay clean.
- **Soft, wide glow.** More weight on the medium and far bloom levels, with a larger radius.
- **Camera approach.** *Begin observation* eases the framing (centre, roll, field of view) over 1.2 s, re-baking
  geodesics each frame at half resolution, then does one full-resolution bake when it settles. *Return* reverses it. Reduced motion cuts instantly.
  It is an optical zoom, so standoff, inclination and disk extent stay true.

## The encounter (Explorer direction)

The visitor stands on the observation deck of the fictional deep-space vessel *Horizon*. The page runs one
encounter in three stages: **Observe → Investigate → Record**.

- **Arrival.** The black hole fills the window, with a narrow graphite window edge and faint corner reflections. The headline reads
  *We came to see what lies beyond.* Actions: **Begin observation** and **Mission briefing**.
- **Observe.** The headline recedes, the camera eases in to centre the black hole (instant under reduced motion),
  and the bottom science console appears. The scan waits until the camera settles. Drag, or use ← →, to turn the view.
- **Investigate.** **Scan black hole** runs a single 1.9 s sweep, then reveals three annotations (shadow, photon
  ring, accretion disk) and a findings list labeled *Illustrative scan · simulation values, not instrument data*.
  Annotation positions are projected from the camera framing (`src/encounter/anchors.ts`), so they line up on
  both the live render and the fallback posters. **Hide annotations** gives a clean view.
- **Record.** **Record encounter** writes a short entry to `localStorage` (`src/encounter/log.ts`). If storage is
  blocked, the entry is kept in memory and the UI says it lasts only for this visit. **Open log** reopens it in the
  same dialog that holds the briefing and credits, so there is never more than one dialog.
- **Return.** **Return to arrival** or **Esc** works from every stage. Scan and record progress is kept for the session.
  Scan completion and recording are announced once through a polite live region.
- **Pause / Resume motion** remains available on arrival and in the console.

Numbers come from the renderer settings: standoff 13.5 R<sub>s</sub>, inclination 9.2°, inner stable orbit 3 R<sub>s</sub>,
disk extent 9 R<sub>s</sub>. The shadow radius (≈ 2.6 R<sub>s</sub>, √27/2) is the Schwarzschild value for that model.

## Verification performed

On this machine (macOS 15.2, Apple Silicon, Metal), with headless Google Chrome via Playwright against
`npm run preview`, the following automated checks pass: the 24-check base suite, 10 polish checks, and 94 encounter
checks, now 98 with the camera-approach check (the full flow for mouse, keyboard-only, reduced motion, no WebGPU, blocked storage, mobile touch, and mobile without WebGPU,
plus log persistence across reload and corrupt-storage handling):

- Live WebGPU render runs (adapter `apple metal-3`), animates, freezes on pause, and resumes.
- No horizontal overflow at 1440×900 or 390×844 (DPR 3). Nothing is clipped. Body text is 18px. There is one `h1`.
- The briefing opens by keyboard, contains focus across Tab presses, closes on Escape, and restores focus.
- Observation mode enters (UI inert, focus on Exit). Arrow keys and drag work. Escape exits and restores focus.
- Reduced motion starts paused.
- Forced no-WebGPU shows the poster fallback with a status line. Observation mode and Escape still work.
- A simulated device loss (`GPUDevice.destroy()`) switches to the fallback.
- No console errors or failed requests in any scenario. The only warning is the expected one logged on device loss.
- Credits opens the briefing at the credits section and restores focus. `licenses.txt` resolves. The geometry disclosure opens.
- At 360px there is no overflow. The mobile secondary action has a 48px touch target and keeps its focus outline.
- Under reduced motion, observation mode switches framing instantly (no fade to black) and Escape exits.
- `npm run build` succeeds. `npm run dev` serves and transforms the WGSL.

The posters and composition were also checked by reading back headless Node renders (`vgpu doctor` reports healthy).

### Not verified

- Safari, Firefox, and Chrome on Windows, Linux, or Android. No physical phones or touch hardware (mobile was emulated).
- Real slow or low-end GPUs, so the adaptive quality steps were not exercised on actual slow hardware.
- Screen-reader output (the semantics were reviewed, not tested with VoiceOver or NVDA).
- Hidden-tab pausing and live `prefers-reduced-motion` changes were implemented but not tested automatically.

## Notes

- `npm audit` reports a high-severity advisory in `@modelcontextprotocol/server`, which vgpu pulls in for its
  CLI's MCP server. It is not bundled into the site.
- No `.openai/hosting.json` existed in this folder, and nothing was deployed.
- Credits and license notices (vgpu MIT, fonts OFL-1.1) are in `public/licenses.txt`, linked from the footer.
