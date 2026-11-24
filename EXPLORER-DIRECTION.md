# EVENT HORIZON — Explorer Experience

## Status and precedence

This is the next creative direction for the existing EVENT HORIZON project. Read the application's AGENTS.md, CLAUDE.md, DESIGN.md, and implementation first. This brief supersedes earlier presentation and interaction direction where they conflict; retain existing accessibility, performance, fallback, and validation requirements.

Build on the working application. Do not create a second app or replace its real vgpu black hole with an image. Do not deploy.

## Creative premise

The visitor is an explorer aboard the fictional deep-space vessel Horizon, looking through its observation window at a black hole. The page progresses from a moment of wonder into a small scientific encounter.

Take inspiration from Star Trek: The Next Generation's curiosity, calm exploration, and scientific discovery. Interpret that feeling through a modern fictional NASA expedition. Create an original interface rather than copying LCARS, Starfleet branding, recognizable sets, dialogue, or sound effects.

## Chosen direction

Combine an observation lounge with a restrained science station. Space occupies most of the screen. The ship is implied through a narrow window edge, faint perimeter reflections, and a compact bottom instrument surface.

Avoid a fully modeled cockpit, bulky window framing, prominent furniture, game HUD clutter, and permanently visible instrument panels. The black hole must remain the dominant visual.

## Scope for this iteration

Implement one complete black hole encounter with three stages: Observe, Investigate, Record. Additional destinations, an expedition map, audio, and narrative puzzles are future ideas, not requirements for this iteration. Do not add dead controls for them.

### Arrival / Observe

- Open on the black hole with minimal ship cues and restrained interface.
- Use a small identifier: **Deep-space vessel Horizon · Observation deck**.
- Suggested headline: **We came to see what lies beyond.**
- Primary action: **Begin observation**.
- Keep a discreet fictional mission concept credit and access to credits/licenses.
- Begin observation transitions into the science interface; the large headline recedes and the scene gains space.
- Retain gentle viewing controls, pause/resume, and a clear way to return to the arrival view.
- Reuse the existing observation behavior where practical rather than adding a competing mode.

### Investigate

- Offer one clear **Scan black hole** action.
- Use a brief, restrained scan treatment with a definite end state; do not run a decorative scan indefinitely.
- Reveal up to three readable annotations explaining the shadow, photon ring, and accretion disk.
- Position annotations away from bright regions and keep connecting lines sparse.
- Include a concise findings summary in a compact panel or disclosure.
- Distinguish simulated observation from real instrument data. Use **Illustrative scan** or equivalent language.
- Tie any numerical readouts to real renderer settings where applicable. Avoid invented live telemetry or claims that a shader scan measures actual astrophysical data.
- Preserve a clean view toggle so the visitor can enjoy the scene without annotations.
- Reduced-motion users should receive results without a sweep or camera animation.

### Record

- After investigation, offer **Record encounter**.
- Create a short expedition-log entry containing the encounter name and concise findings.
- Show a clear recorded state and let the visitor reopen the entry.
- Keep the log local to the browser; no account, backend, or external submission is needed.
- If using localStorage, handle unavailable storage gracefully and accurately communicate whether the entry persists.
- Reuse the existing accessible briefing panel for the log or supporting mission content where appropriate. Avoid layering multiple drawers and dialogs.

## Visual language

- Space: deep black, warm starlight, amber-white accretion disk.
- Interior: graphite with soft ivory text and a restrained cool-blue instrument accent.
- Retain Instrument Serif for arrival copy and reflective narrative moments.
- Use a clean sans serif for controls and readable explanations; reserve monospace for instrument labels.
- Keep stars quiet behind text. Retain the earlier fixes for headline contrast, telemetry placement, and simplified credits.
- Suggest glass only near the window perimeter. Avoid a full-screen milky overlay or distracting reflections across the black hole.
- Keep interior cues subtle enough that this feels like an observatory rather than a spacecraft dashboard.
- Motion should feel deliberate: gentle camera changes, short interface transitions, and one scan event with an obvious result.
- Do not autoplay audio. Audio is outside this iteration's scope.

## Mobile

- Preserve a large observation area with content and controls below or around it as space permits.
- Adapt the bottom instrument surface into a compact control row or sheet.
- Put annotation explanations in a readable list when in-scene labels would overlap.
- Keep touch targets comfortable, allow natural scrolling, and avoid relying on hover.
- Ensure all stages and return paths work on narrow screens.

## Accessibility and resilience

- Retain reduced-motion behavior, pause/resume, keyboard operation, visible focus, and accessible dialogs.
- Announce scan completion and recording success without excessive live-region chatter.
- Keep scene information available as text.
- Preserve fallback posters, device-loss handling, adaptive resolution, hidden-tab rendering behavior, and cleanup.
- Scan and log interactions must work when WebGPU is unavailable; use the fallback visual with the same clearly illustrative explanations.
- Regenerate posters if the visual framing or grading changes.

## Implementation approach

Before editing, summarize the existing components you will reuse and the intended state flow in a few sentences. Proceed with this agreed direction unless local project rules explicitly require a further decision. Resolve routine details using the existing code and this brief.

Implement the smallest coherent experience first. Favor reusing the current renderer, observation controls, briefing panel, and typography. Keep state transitions explicit and provide a visible return path from every stage.

## Definition of done

1. The visitor can enter observation, complete a scan, inspect findings, record the encounter, reopen the log, and return to the arrival view.
2. The black hole remains the visual centerpiece throughout.
3. Ship cues feel subtle and intentional on desktop and mobile.
4. Controls work with keyboard and touch; reduced-motion and fallback users can complete the same encounter.
5. Existing performance and accessibility safeguards remain intact.
6. The production build and relevant existing browser checks pass; update checks meaningfully for the revised state flow.
7. Review before/after screenshots at matching desktop and mobile viewports, including arrival and scan-results states.
8. Report what changed, verification results, and any unverified behavior. Do not claim checks that were not performed.
