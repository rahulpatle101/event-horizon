# EVENT HORIZON — Art Direction & Polish

## Purpose

Polish the existing fictional NASA mission hero running at `http://localhost:5174/`. Preserve its working vgpu rendering, fallback, accessibility, and controls. This is a focused art-direction pass, not a rebuild or expansion into a full website.

The implementation was reported to live in `day-002/`. This document was saved in `day-02-event-horizon/`, the project folder available to the reviewer. Locate the actual application before editing; do not create a second implementation.

## Direction: an editorial observatory

Make the page feel like looking through a scientific instrument at something immense: expansive darkness, one extraordinary object, expressive typography, and a few precise annotations.

The visual hierarchy should be:

1. Black hole and accretion disk.
2. Headline.
3. Primary mission action.
4. Supporting copy.
5. Mission identity, geometry, and utility controls.

Use the current warm ivory, amber-white light, and near-black space. Do not introduce additional accent colors, glass cards, neon UI, or decorative dashboard elements.

## Review basis

The reviewer inspected the live desktop hero, mission briefing, observation mode, and a 390 × 844 mobile viewport. This was a visual review, not a repeat of the reported automated checks or a cross-browser verification.

The strongest existing elements are the real black hole visual, Instrument Serif headline, warm palette, and mobile composition with the black hole above the copy. Keep these.

## Priority 1 — Quiet the background

### Observed

Stars occupy almost every dark region, competing with the typography and technical labels. The scene needs more empty space to communicate scale.

### Change

- Start by reducing overall star brightness by roughly 40–60%; judge visually rather than treating this as a fixed requirement.
- Reduce the visibility of small stars, preserving a few brighter points for depth.
- Apply stronger attenuation behind the headline and body copy with a broad, soft transition. Avoid an obvious rectangular text scrim.
- Preserve deep blacks around the shadow. Do not brighten the whole scene to recover text contrast.

### Success condition

The black hole reads immediately, while stars become background texture. Body copy and labels can be read without visually filtering out the star field.

## Priority 2 — Resolve the headline and disk overlap

### Observed

The italic word “unknown” crosses a bright part of the disk. Its thin strokes lose separation, and the text competes with the visual's strongest edge.

### Change

- Keep Instrument Serif and the italic emphasis on “unknown.”
- Adjust headline width, line breaks, or camera framing so most of the final word sits against darkness.
- Retain a small, intentional overlap only where letterforms remain clear.
- Coordinate the headline and camera as one composition. Do not solve the problem only by shrinking the text.
- Preserve room between the headline, supporting paragraph, and actions.

### Success condition

The headline has a clear silhouette at a glance, and the brightest disk edge remains visually uninterrupted enough to convey the black hole's shape.

## Priority 3 — Simplify and protect telemetry

### Observed

The luminous disk intersects the lower-right telemetry heading. Several subdued labels become difficult to read.

### Change

- Place geometry information in a consistently dark region.
- Show only two readings in the hero: **Standoff** and **Inclination**.
- Move inner stable orbit, disk extent, and other detailed geometry into the briefing or a dedicated disclosure within it.
- Retain an explicit **Illustrative geometry** label.
- Increase label contrast and use consistent label/value alignment.
- Keep units and values tied to actual render settings. Do not replace them with invented live mission data.
- Use fine rules sparingly; avoid boxing the telemetry into a card.

### Success condition

Both readings are easy to scan, remain legible throughout animation, and support rather than compete with the hero.

## Priority 4 — Refine light and color

- Preserve the warm ivory interface and amber-white disk.
- Test a modest bloom reduction to recover texture near the brightest disk edge.
- Keep a luminous core and softer surrounding glow. Avoid making the disk flat or uniformly orange.
- Evaluate color grading on the live shader and fallback poster together.
- If framing or grading changes, regenerate the fallback posters with the existing poster workflow.

## Priority 5 — Clean up identity and utilities

### Mission identity

- Give **EVENT HORIZON** slightly more presence through weight or size and moderately tighter tracking.
- Keep the mission identifier secondary.
- Treat “Day 002 / 100” as a project credit rather than a major mission-interface element.

### Footer

- Use one concise visible credit: **Fictional NASA mission concept**.
- Move the longer disclaimer, implementation credits, and license details into an accessible credits or briefing view.
- Preserve access to all license notices.
- Keep pause/resume discoverable and keyboard accessible.
- Reduce the number of competing separators and text groups along the bottom edge.

## Mobile polish

- Preserve the current sequence: mission identity, black hole, headline, supporting copy, actions.
- Keep the black hole large enough to reveal the shadow and photon ring.
- Use a solid full-width **Explore the mission** button as the primary action.
- Present **Enter observation mode** as a quieter text or icon-and-text action with a generous touch target.
- Preserve visible keyboard focus; the quieter treatment must not remove its focus indicator.
- Keep body text at least 16px and avoid horizontal overflow.
- Let content scroll naturally on short screens. Do not compress the layout to force everything into one viewport.

## Mission briefing

The existing panel matches the visual direction but is prose-heavy.

- Keep the heading **Watch the edge. Never cross it.**
- Shorten the introductory paragraph.
- Use clear sections for objective, probe, and observation plan.
- Consider one compact trajectory diagram or observation sequence to explain the mission spatially. Mark it illustrative and keep it consistent with the fictional concept.
- Avoid adding visual material that implies an actual engineered mission or validated trajectory.
- Preserve dialog naming, focus containment, Escape, close control, and focus restoration.

## Observation mode: verify before changing

In a frame captured immediately after entering observation mode, the black hole remained right-biased and help/exit controls were not visible, although those controls appeared in the accessibility tree. This may have been a transition frame; it is not a confirmed settled-state defect.

Check the completed transition and ensure:

- The black hole moves to a balanced observation framing.
- Exit and pause controls remain visibly discoverable with adequate contrast.
- Keyboard and drag instructions appear without dominating the scene.
- Escape exits and restores focus.
- Reduced-motion users receive a usable transition without unnecessary camera movement.

## Implementation boundaries

- Preserve the actual vgpu visual and its performance safeguards.
- Preserve no-WebGPU fallback, device-loss handling, tab-visibility behavior, and resource cleanup.
- Preserve pause/resume and reduced-motion behavior.
- Avoid adding dependencies solely for this polish pass.
- Do not deploy unless requested.
- Inspect and follow the actual application's local guidance before editing.

## Recommended sequence

1. Capture a baseline at desktop and mobile sizes.
2. Tune stars, headline placement, and telemetry together.
3. Refine bloom and regenerate posters if needed.
4. Simplify footer and mobile action hierarchy.
5. Polish the briefing and verify observation mode's settled state.
6. Compare before/after captures at the same viewport and camera state.
7. Run the production build and relevant existing browser checks after changes.

## Acceptance checklist

- [ ] The black hole is the immediate focal point.
- [ ] The headline remains readable across animation frames.
- [ ] Stars support depth without competing with content.
- [ ] Hero telemetry contains two readable, accurately sourced settings.
- [ ] Primary and secondary actions have distinct visual weight.
- [ ] Footer credits are concise and full notices remain accessible.
- [ ] Mobile retains comfortable spacing and readable copy.
- [ ] Briefing and observation controls remain accessible.
- [ ] Reduced motion, pause/resume, and fallback remain functional.
- [ ] Live and fallback compositions match after any visual changes.
- [ ] Production build and relevant existing checks pass.
- [ ] Any unverified behavior is reported accurately.

## Reference direction

These references were identified during research. Gallery entries establish the reference; their live interactions were not all tested. Use them to study principles rather than reproduce layouts.

- [Star Atlas — Awwwards](https://www.awwwards.com/sites/star-atlas): immersive space presentation and exploration interface.
- [Léo Parpeix — Lapa Ninja](https://www.lapa.ninja/post/leo-parpeix/): expressive 3D presentation and typography.
- [DADA PROJECTS — Lapa Ninja](https://www.lapa.ninja/post/dada-projects/): motion-led art direction.
- [vgpu — Optimized Black Hole](https://vgpu.sh/examples/optimized-black-hole): the project's rendering foundation.
