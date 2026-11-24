# EVENT HORIZON — Day 2

## Project mission

Design and build a visually stunning landing-page hero for **EVENT HORIZON**, a fictional NASA robotic mission to study a black hole from outside its event horizon. The visual experience is the centerpiece.

This is a creative concept, not an actual NASA mission. Clearly identify it as a fictional mission concept in a discreet footer or credit. All mission dates, spacecraft details, and telemetry are illustrative.

## Starting point

- This directory contains an initial npm project with `vgpu` and `vite` installed.
- The hero has not been implemented. Inspect the current files before making changes.
- Use a lightweight Vite application with HTML, CSS, and JavaScript or TypeScript. Avoid unnecessary frameworks and dependencies.
- Add working `dev`, `build`, and `preview` scripts. Production output should be `dist/`.
- Preserve any existing `.openai/hosting.json` and its project ID. Do not register another hosted site. Build locally unless the user explicitly requests deployment.

## Required visual: vgpu

Explore the examples and use the **Optimized Black Hole** as the starting point:

- Gallery: https://vgpu.sh/examples
- Selected example: https://vgpu.sh/examples/optimized-black-hole
- Source: https://vgpu.sh/examples/optimized-black-hole/source.md
- Repository: https://github.com/vercel-labs/vgpu

Retrieve the example with:

```sh
npx vgpu examples pull optimized-black-hole --out ./reference
```

Read the installed version's documentation and the downloaded source before implementing. Use `npx vgpu --help` to discover available documentation and validation commands. Do not guess the API or assume the live website matches the installed version.

The earlier source download failed because of network access; it has not been successfully retrieved. If downloading remains unavailable, report that limitation accurately. Do not claim to have copied the example or its Copy Prompt without doing so.

Use real vgpu/WebGPU rendering as the primary visual. Preserve the example's gravitational lensing, dark event horizon, luminous accretion disk, and bloom where practical. Adapt its presentation to the hero rather than embedding the example's demo interface. Retain required upstream license notices.

## Art direction

Create a cinematic editorial composition: deep black space, warm ivory typography, a blazing amber-white accretion disk, and restrained technical details. The black hole should dominate the viewport and feel immense.

- Use generous negative space and an intentional asymmetrical layout.
- Let typography overlap the visual carefully while preserving readability.
- Use a distinctive large display headline, clean body typography, and monospaced telemetry labels.
- Avoid generic feature cards, excessive gradients, glass panels, decorative badges, and dashboard clutter.
- Use fine rules and sparse orbital or targeting marks only when they support the mission aesthetic.
- Keep the scope focused on a polished hero. Do not expand into a full marketing site without a request.

## Suggested content

- Mission name: **EVENT HORIZON**
- Eyebrow: **NASA / DEEP SPACE EXPLORATION**
- Headline: **TO THE EDGE OF THE UNKNOWN.**
- Supporting copy: **A robotic journey to the boundary of a black hole. To observe gravity at its most extreme—and bring the unknown into focus.**
- Primary CTA: **Explore the mission**
- Secondary action: **Enter observation mode**
- Credit: **Fictional NASA mission concept · Day 2 of 100 Days of Digital Craft**

Refine the wording when it improves the composition. Avoid suggesting a probe can cross the event horizon and transmit data back.

## Interaction

- “Explore the mission” opens an accessible briefing panel or dialog with the objective, fictional probe concept, and observation plan.
- “Enter observation mode” hides most interface elements so visitors can explore the black hole. Provide a clear exit and support Escape.
- Use subtle pointer-driven movement or the example's orbit controls if supported. Keep camera motion restrained.
- Offer a pause/resume control for animation. Respect `prefers-reduced-motion` from the first frame.
- All controls must perform their stated action. Do not add dead navigation links, fake video buttons, or fabricated live-data indicators.

## Performance and resilience

- Resize the canvas with its container and cap device pixel ratio appropriately.
- Adapt rendering quality for smaller screens and slower devices. Avoid reallocating GPU resources every frame.
- Pause unnecessary rendering when the tab is hidden and dispose of GPU resources and listeners on teardown.
- Handle unsupported WebGPU, initialization failures, and device loss gracefully. Provide an intentional static fallback that preserves the composition and usable text and controls.
- Do not leave visitors on a blank canvas or indefinite loading screen.

## Accessibility and responsive layout

- Use semantic landmarks, one clear `h1`, real buttons, and visible keyboard focus.
- Keep normal body text at least 16px and maintain strong contrast.
- Dialogs must have accessible names, keyboard support, focus containment, and focus restoration.
- Treat the canvas as decorative when equivalent information is provided in text.
- Verify a narrow mobile viewport and a wide desktop viewport. Prevent horizontal overflow, clipped copy, and controls hidden behind the canvas.

## Definition of done

1. The hero renders with the actual vgpu visual on a supported browser.
2. An attractive fallback works without WebGPU.
3. Mission briefing, observation mode, Escape, and pause/resume work with mouse and keyboard.
4. Desktop, mobile, and reduced-motion layouts are checked.
5. `npm run build` succeeds, and the production preview loads without application errors.
6. Document how to run the project and any remaining verification limits. Do not claim browser or GPU checks that were not performed.

Prioritize visual craft and a complete, reliable hero over additional sections or tooling.
