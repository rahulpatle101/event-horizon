# EVENT HORIZON — Black Hole Look (from reference video)

## Status

Refines the black hole's rendering and its arrival-to-observation camera move. It builds on
EXPLORER-DIRECTION.md and DESIGN.md: the encounter flow, interface, accessibility, fallback and
performance rules stay unchanged. Where the disk's look conflicts with earlier wording ("amber-white
accretion disk"), this document wins for the disk only. The interface keeps its warm ivory and
amber identity.

Source: `reference-video/blackhole-reference.mov` (11.6 s, 2230×948, 60 fps). It was reviewed frame by frame.
It comes from another studio's site, so we borrow **rendering qualities and principles only**. We do not copy
its copy, its "hold to ignite" interaction, its lensed-typography layout, or its cursor crosshair.

## What the reference does well

1. **A silky disk.** The disk reads as long-exposure silk: fine, continuous concentric striations that sweep
   around the hole, with almost no clumpy turbulence. Detail comes from the many thin bands, not from noise blobs.
2. **A restrained palette.** Near-monochrome silver-white. The approaching (left) side blooms to clean white
   with a faint cool cast, and the receding side falls off to soft grey.
3. **Optical fringing.** A thin rainbow chromatic fringe (warm outside, cool inside) traces the photon ring
   and the shadow edge, the way a real lens shows it at high contrast. It's what makes the image feel photographed.
4. **A soft, wide glow.** The halo is broad and gentle. The black shadow stays crisp and deep inside it.
5. **Scale through width.** The disk runs off both sides of the frame while the shadow stays relatively small,
   so the object feels larger than the screen.
6. **One deliberate camera move.** The camera slowly approaches, and up close the lensing becomes the subject.
7. **Hairline annotation.** Thin leader lines, small open circles and italic serif notes, never boxed.

## Decisions (agreed)

- **Palette: silver with a warm core.** Use the reference's silver-white disk and chromatic fringe, but keep a
  faint warm ivory at the hottest inner region so the object belongs to the warm interface.
- **Camera: approach on Observe.** *Begin observation* eases the camera closer and re-centres it over
  about 1.2 s, replacing the fade-to-black cut. Reduced-motion users still get an instant cut.

## Rendering spec

| Quality | Implementation |
| --- | --- |
| Silky striations | Disk look: high angular stretch, low turbulence and fray, finer radial detail, softer contrast, faint clouds |
| Silver + warm core | `disk.wgsl` thermal ramp: cool grey → silver-white, warming to ivory only at the hottest inner radii |
| Cool approaching side | A small blue lift on the Doppler-boosted side, kept subtle |
| Chromatic fringe | `composite.wgsl`: radial RGB split around the shadow centre, strongest on bright edges and capped at the frame edges |
| Soft wide glow | More weight on the medium and far bloom levels and a slightly larger radius. The shadow core stays black |
| Grade | Lower saturation. Warmth stays in the highlights only |

Physical settings that the interface quotes stay fixed: standoff 13.5 R<sub>s</sub>, inclination 9.2°,
inner stable orbit 3 R<sub>s</sub>, disk extent 9 R<sub>s</sub>. The camera move is an optical zoom and
re-centre, not a change of distance, so every published number stays true.

## Camera move

- Interpolate the framing (centre, roll, field of view) with an ease-in-out curve over about 1.2 s.
- Re-bake geodesics every frame during the move at reduced resolution, then do one full-resolution bake when it settles.
  This keeps the move smooth on slower GPUs.
- Returning to arrival uses the same move in reverse.
- With reduced motion, or without WebGPU, the framing cuts instantly. The fallback swaps posters.

## Annotations

Keep the existing three scan annotations and their positions. Adopt the reference's lighter touch:
italic serif sub-notes, hairline leaders, and open circles at the anchors.

## Out of scope

Lensed typography, a cursor crosshair, hold-to-trigger interactions, audio, and other destinations.

## Acceptance

- The disk reads as silky silver striations with a warm inner core. It is not uniformly orange and not clumpy.
- A visible but thin chromatic fringe on the photon ring and the shadow edge, without colour noise across the scene.
- The glow is soft and wide, and the shadow stays crisp black.
- The arrival headline still sits on darkness, and the telemetry stays in a dark region.
- Begin observation shows a smooth approach. Return reverses it. Reduced motion cuts instantly.
- The fallback posters are regenerated and match the live look.
- The production build and all existing browser checks pass.
