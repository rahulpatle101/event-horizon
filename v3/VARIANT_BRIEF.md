# V3 — DOCK: "Thread the needle."

**Day 002 / 100 Days of Digital Craft** · Variant 3 of the NASA mission hero · Route `/v3/`
**Art direction:** `ART_DIRECTION_space-station.md` (wins on *how it looks and moves*). This brief wins on *what to build*.
**Status:** APPROVED 2026-11-24 with edits (headline, autopilot timing, idle-timer start, offset range, touch handling). Build order: static layout → review → motion pass.

---

## 0. One-liner

> **A landing-page hero for a fictional crew-rotation mission, where the visitor docks the shuttle to bring the station, and the page, online.**

## 1. Concept

You are flying shuttle **WREN 26-4** on final approach to **Tessaly Ring**, a slowly turning ring station. One berth, **PORT 04**, has to line up with your crosshair before the station will accept you. Drag the ring until the port aligns, hold it steady for a second, and the station locks you in. Then it wakes up: the space behind it warps, a nebula blooms inside the warp, `STANDBY` flips to `ONLINE`, and the mission headline boots in.

**Hook:** the call to action is earned. The page literally comes online because you docked.

**Names are original** (per §3 and §9 of the art direction): Tessaly Ring, WREN 26-4, PORT 04 and Crew Rotation 26-4. No franchise names, insignia, panel layouts or ship designs.

## 2. Copy deck (proposed)

| Slot | Copy |
|---|---|
| Eyebrow (mono) | `26-4 · CREW ROTATION` · `NASA / TESSALY RING` |
| Affordance (mono, on the stage) | `04-11 · DRAG TO ALIGN` |
| Status readout (Antonio, amber) | `STANDBY` → `ALIGNING` → `HOLD` → `LOCKED` → `ONLINE` |
| Autopilot label | `09 · AUTOPILOT` |
| Readouts (console) | `218 · RANGE 240 M` · `07 · RATE 0.12 M/S` · `04 · OFFSET 47.3°` · `PORT 04` |
| Headline (after ONLINE, Antonio, alone in the void) | **TESSALY RING · ONLINE** |
| Subline (IBM Plex Sans Condensed) | Crew rotation 26-4 has docked. Six months on the ring begins now. |
| Primary CTA (amber pill) | View the mission |
| Replay (periwinkle pill) | Replay docking |
| Void caption (≤ 6 words, mono, centred) | `A RING IN THE DARK` |
| Footer | Fictional mission concept. Not affiliated with NASA. |

All numbers are fictional but plausible, and every label pairs a code with a word (§5).

## 3. Composition

**Desktop (≥ 768px)**
- **Void (back):** black with a 3-layer parallax starfield. ≥ 55% of the viewport stays empty.
- **Instrument (centre):** Tessaly Ring as a hairline SVG diagram, centred: outer hull ring, tick ring every 5° and 15°, four spokes, a hub, and PORT 04 marked on the rim. Crosshair registration lines run from the centre to all four viewport edges in `--line-lo`. A hairline spatial grid sits behind the station (it warps at lock).
- **Console (one corner, bottom-left):** an L-shaped elbow. The vertical bar runs up the left edge; the horizontal bar runs along the bottom, split into segments (long, short, short, long) with half-pill caps. Readouts and the status word live here. The hold segment is one of the bottom segments.
- **Warmth:** the cream glow is used only on the locked port and the pill hover glow.
- **After ONLINE:** the headline, subline and CTA boot into the top-left void using the console boot motion. The station stays centred and becomes the backdrop.

**Mobile (< 768px)**
- The station is centred in the upper ~55% of the screen. The console becomes a bottom bar (full width, one elbow at the left).
- Touch: the ring area is the only drag target, with `touch-action: pan-y` (see §5.3). Vertical swipes scroll the page.
- After ONLINE, the headline and CTA boot in below the station; the page scrolls naturally.

## 4. Story beats

| # | Beat | What happens | Time |
|---|---|---|---|
| 1 | **Standby** | Pure black, a single dim crosshair. Stars fade in. | 0–0.6 s |
| 2 | **Approach** | The station draws itself (outer ring → tick ring → spokes → hub, via stroke-dashoffset, outer first). It starts at a random offset of **30–90° either way** and turns slowly (period 120 s). | 0.6–1.8 s |
| 3 | **Console boot** | The elbow slides in, segments wipe left → right (40 ms stagger), readouts tick to their values (≤ 900 ms, mono scramble at the end). `STANDBY` pulses in amber. The affordance appears. | 1.8–3.2 s |
| 4 | **Align** | The visitor drags the ring. The offset readout and arrow respond; inside ±3° the magnetic assist eases it in; inside tolerance the status reads `HOLD`. | user-paced |
| 5 | **Lock** | Hold in tolerance for 1 s while the hold segment fills → `LOCKED`. | 1 s |
| 6 | **Online (signature)** | The grid behind the station warps, a nebula blooms *inside the warp only* (ion/plasma, the 2% colour moment), the hold segment turns periwinkle, and `STANDBY`/`LOCKED` flips to `ONLINE`. | ≤ 1.2 s |
| 7 | **Handoff** | The headline, subline, CTA and Replay boot in with the console boot motion (segment wipe, 40 ms stagger). | 0.6 s |

The boot (beats 1–3) totals ≤ 3.5 s and is skippable: any click, key or drag during the boot jumps to the end of beat 3 and hands over control.

## 5. Interaction model

### 5.1 States

```
BOOT ──(done / skip)──▶ STANDBY ──drag/keys──▶ ALIGNING ──within ±1.5°──▶ HOLD ──1 s──▶ LOCKED ──▶ ONLINE ──▶ HANDOFF
                          │  ▲                    │  ▲                       │
                          │  └──── input ─────────┘  └──── leaves tolerance ┘ (fill drains)
                          └── 6 s no input ──▶ AUTOPILOT ──(reaches 0°)──▶ HOLD …   (any input cancels autopilot)
ONLINE/HANDOFF ──Replay──▶ BOOT (fresh random offset)
```

- **Tolerance:** |offset| ≤ 1.5°.
- **Magnetic assist:** when |offset| ≤ 3° (and on release, or while dragging slowly at < 20°/s), the ring eases to exactly 0° over 280 ms with `--ease-system`. There's no overshoot, because the art direction forbids springs.
- **Hold:** starts the moment the offset is within tolerance, whether or not the pointer is down. The hold segment fills left → right over 1 s (linear). Leaving tolerance drains it over 280 ms; it never jumps.
- **Idle timer:** the 6 s idle timer **starts only after the console boot finishes** (end of beat 3), and restarts after every input.
- **Autopilot:** if there's no input for 6 s in STANDBY or ALIGNING, autopilot docks automatically. It **always takes about 3.5 s regardless of the starting offset**, on an **easeInOut** curve (`cubic-bezier(0.65, 0, 0.35, 1)`) with **no overshoot**. The status shows `09 · AUTOPILOT` and the affordance dims. On arrival it goes through **the same 1 s hold fill and lock** as a manual dock, so the payoff is identical. Any pointer or key input cancels it immediately and hands control back, with the 6 s timer reset.
- **Ambient drift:** before lock, the ring keeps its slow 120 s rotation *on top of* the user offset, so a released ring doesn't freeze. Magnetic assist and hold use the offset relative to the port, so the drift never breaks a lock in progress.

### 5.2 Affordance (before the first input)
- The label `04-11 · DRAG TO ALIGN` sits beside the station in mono, with a leader line to PORT 04.
- A custom **rotate cursor** (a drawn arc with an arrowhead, SVG cursor) shows over the stage. It's not an icon-library glyph (§12).
- A **pulsing offset arrow**: an arc arrow on the tick ring between PORT 04 and the crosshair's top, pointing the shortest way to alignment. It uses the standby pulse (1 → 0.45 → 1 over 1.6 s, `--ease-signal`), and its length tracks the offset.
- All three fade after the first successful drag (`--t-base`). The arrow stays during ALIGNING as live feedback, without the pulse.

### 5.3 Feedback per input

| Input | Feedback |
|---|---|
| **Pointer hover (stage)** | Rotate cursor. The nearest tick on the tick ring brightens (`--line-hi`). Starfield parallax ±4 / ±8 / ±14 px; the station stays still (it's the anchor). |
| **Drag (mouse / pen)** | The ring rotates by the pointer's angle around the station centre (1:1, so it feels physical). The offset readout updates live (one decimal), the arrow shortens and flips direction when crossing 0, and the status reads `ALIGNING`. |
| **Touch** | **The ring area is the only drag target.** The stage uses `touch-action: pan-y`, so vertical swipes always scroll the page. A touch gesture **rotates only when it's mostly horizontal or circular**: decided over the first ~10 px of movement, it rotates if the horizontal component dominates (\|dx\| > \|dy\|) or the angular sweep around the centre exceeds ~6°. Otherwise it's left to the browser as a scroll. Once rotating, it behaves like a mouse drag. |
| **Enter tolerance (±1.5°)** | A tick at the crosshair lights cream, the status reads `HOLD`, and the hold segment begins filling. |
| **Release inside ±3°** | Magnetic ease to 0° (280 ms). |
| **Leave tolerance** | The hold segment drains (280 ms) and the status returns to `ALIGNING`. |
| **Keyboard** | The stage is a focusable `role="slider"` (accessible name "Docking alignment"), with `aria-valuenow` = offset in degrees and `aria-valuetext` like "4.2 degrees left of port". ← / → turn 1°, Shift+← / Shift+→ turn 10°, and Home aligns to 0° (an explicit "assist"). The 1 s hold then runs as normal. A visible 2px cream focus ring sits on the stage (§13). |
| **Autopilot** | The status reads `09 · AUTOPILOT`, the arrow animates along the path, and the hold segment fills when it arrives. |
| **Lock → Online** | One short polite `aria-live` announcement: "Docked at port 04. Tessaly Ring is online." |
| **Replay** | Restarts the boot with a fresh random offset. Focus moves to the stage. |
| **Wheel / scroll** | Never hijacked; the page scrolls normally. |

### 5.4 Reduced motion (`prefers-reduced-motion: reduce`)
- **Static final state on load:** the station is aligned and locked, `ONLINE`, with the grid warp and nebula shown as a still frame, and the headline, subline and CTA already visible. There's no boot, parallax, orbit, autopilot or pulse.
- **Replay** still works and lets the visitor dock manually. Drag and keys move the ring directly (user-initiated), the magnetic assist and hold become instant state changes, and `LOCKED → ONLINE` is a cut.

## 6. Rendering plan

- **Starfield:** Canvas 2D, 3 parallax layers, sparse, ≤ 5% twinkle (§7.5).
- **Station, crosshair, grid (static), console, affordance:** SVG, with `vector-effect: non-scaling-stroke` hairlines and tokens via CSS custom properties.
- **Grid warp + nebula (signature only):** **vgpu**, one surface and one effect, keeping Day 2's tech thread. It's a transparent canvas layer above the SVG grid and below the station, and runs only around the lock moment and the ONLINE resting state. The nebula colour exists only inside the warp mask.
- **Static fallback:** without WebGPU, or on failure, the SVG grid gets a CSS/SVG-bent overlay plus a pre-rendered nebula image clipped to the warp shape. The full encounter still works.
- **Fonts:** Antonio (display), JetBrains Mono (data), IBM Plex Sans Condensed (body), self-hosted via `@fontsource` rather than the Google Fonts CDN, so there are no third-party requests. That means **3 new font packages** (see §10).
- Pause rendering when the tab is hidden or the stage is out of view, cap DPR at 2, and target 60 fps.

## 7. Accessibility

- One `h1`. Before ONLINE it's a visually hidden mission headline; after handoff the visible headline *is* the `h1`, so it never appears twice.
- The station diagram is decorative (`aria-hidden`); the slider plus the readouts in text carry the information.
- Focus: 2px cream outline with a 2px offset, on every interactive element.
- Contrast: body ≥ 4.5:1; readouts ≥ 3:1 at their large size; dark text on console blocks (§4.3). Verified with measured ratios.
- `aria-live` is used only for lock/online, once. Readouts aren't live regions.
- Every state reachable by mouse, touch and keyboard. Autopilot means nobody gets stuck.

## 8. Scope

**Must-have (MVP)**
- `/v3/` route (new `vite.config.ts` entry), page skeleton, tokens, fonts and footer.
- Starfield, SVG station (hairline, ticks, spokes, PORT 04), crosshair registration lines, static grid.
- Console elbow (bottom-left) with segmented bars, readouts and the status word.
- Drag-to-align (mouse; touch on the ring only with `pan-y` and the horizontal/circular gesture rule), keyboard slider, tolerance ±1.5°, magnetic assist ±3°, 1 s hold segment fill, lock.
- The affordance trio: `DRAG TO ALIGN` label with code, rotate cursor, pulsing offset arrow.
- Autopilot after 6 s of no input (timer starts after the console boot), ~3.5 s easeInOut, through hold + lock.
- ONLINE state plus handoff: headline, subline, CTA and Replay boot in with the console boot motion.
- Replay control. Reduced-motion static final state.
- No-WebGPU path with a static warp/nebula.

**Signature**
- Boot sequence (station line-draw, console segment wipe, readout tick), ≤ 3.5 s and skippable.
- Lock → ONLINE: a vgpu grid warp around the station, with the nebula blooming only inside the warp, one segment turning periwinkle, and `STANDBY` → `ONLINE`.

**Stretch (only if time allows)**
- Subtle range closing: the station scales up 2–3% over the approach, and the range readout ticks to 0.0 m at lock.
- One playful accent (§7.6): a tiny pixel probe drifting across the void.
- A soft mechanical sound on lock (off by default, behind a toggle).
- A "time to dock" readout in the handoff, shareable as a still.

## 9. Acceptance

- Art direction §13 checklist passes: ≥ 55% void, roughly a 70/20/8/2 colour ratio, ≤ 3 console colours at once, tokens only, the three fonts only, codes on every label, elbows on one corner, no springs or overshoot, and the originality test.
- Docking can be completed with mouse, touch, keyboard only, and by autopilot (no input at all).
- Reduced motion shows the static final state; Replay lets them dock manually.
- Without WebGPU, the full encounter works with the static warp/nebula.
- The boot is ≤ 3.5 s and skippable; Replay restarts it.
- 60 fps on this laptop; no console errors; no horizontal overflow at 1440 / 390 / 360.
- Production build passes; V1 and V2 are untouched and their checks still pass.
- Screenshots and a short clip (boot → drag → hold → online → handoff), desktop and mobile.

## 10. Decisions (resolved 2026-11-24)

1. One-liner and names approved. Headline changed to **TESSALY RING · ONLINE** and the subline to "Crew rotation 26-4 has docked. Six months on the ring begins now." The CTA stays **View the mission**.
2. Fonts self-hosted via `@fontsource` (Antonio, JetBrains Mono, IBM Plex Sans Condensed).
3. A V3 line was added to CLAUDE.md.
4. "View the mission" scrolls to a minimal mission section on the same page.
5. Console colours, to stay within §4.3's max of 3: **apricot** (frame), **periwinkle** (data segments, the online segment, the Replay pill), **amber** (status readout, CTA, hold fill).

## 11. Implementation notes (motion pass, 2026-11-24)

- **Ambient drift:** before lock the ring turns at 3°/s (the 120 s period) *away* from the port, capped at 120°, and pauses
  inside the ±3° magnetic zone, while dragging and during autopilot. So the ring never drifts into a lock by itself.
  Disabled under reduced motion.
- **Touch limitation (inherent to `pan-y`):** the browser owns any gesture that *starts* vertically. A circular drag
  that begins on the left or right side of the ring (where the tangent is vertical) scrolls the page instead of
  rotating. Gestures that start on the top or bottom of the ring, or start horizontally anywhere, rotate and can then
  continue around the full circle. Keyboard, autopilot and mouse are unaffected.
- **Hold under autopilot:** the hold starts when the offset enters ±1.5°, which during autopilot's ease-in is ~0.5 s
  before exactly 0°. This is the same rule as a manual dock, so the payoff is identical. Frame trace: in tolerance → LOCKED 1.00 s →
  ONLINE 0.60 s.
- **Signature rendering:** vgpu (one Gpu, one surface, one effect) draws the bent grid and nebula only from lock
  onward, then rests on a final frame. Without WebGPU, the same warp field (`warp/field.ts`) bends the SVG grid and a CSS
  nebula fades in.
