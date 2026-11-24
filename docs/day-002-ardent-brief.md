> Updated 2026-11-24: one-surface rendering, vgpu doctor, task order (particles before the Mars grade), countdown format and footer line. See docs/day-002-progress.md.

Day 002 — ARDENT: Through the Red Window
Nov 24, 2026 · @Rahul
The idea
ARDENT is a fictional NASA crewed-cargo mission to Mars, and its hero is built from one particle system used twice: stars assemble into the mission, then your name assembles and flies to Mars.
• Red Window gives the story. Earth and Mars only line up for an efficient transfer about every 26 months, so the hero is organised around a launch window, not a generic "Explore Mars" headline.
• Assembly gives the craft. A field of stars converges into the ARDENT patch on load, then streams along a transfer arc and reveals Mars.
• The payoff is a real public-engagement mechanic ("send your name"). Visitors type their name, it forms out of stardust, and it launches along the same arc to land as a glint on the planet.
One-line pitch: Stardust becomes a mission, then the mission carries you.
Working mission name: ARDENT. Alternatives if it doesn't land: CINDER, MERIDIAN, OXIDE.
Product framing
The hero has one job: in about 5 seconds, make a curious visitor feel the scale of the mission, understand when it leaves, and take one action.
Visitor
What they want
What the hero gives them
Space fans, the public
Awe and something to share
The assembly moment and their name on Mars
Students, teachers
Why missions launch when they do
The launch window as the organising idea
Press
The facts fast
Mission name, destination, launch window in plain text
Primary action: Send your name to Mars. It is personal, shareable and measurable, and it doubles as the signature interaction.
Secondary action: Read the mission brief (scrolls to the next section).
Success criteria for the build
• Headline and button are readable before the GPU finishes loading.
• The signature moment works with mouse, touch and keyboard.
• It holds 60 fps on a recent laptop and degrades gracefully on a phone.
• Someone watching a 10-second clip asks how it was made.
Experience choreography
The intro runs once in under 5 seconds and never blocks the text: words first, then stars, then the patch, then the arc to Mars.
Only one thing moves at a time. Scrolling or clicking skips straight to Act 3, and return visits within a day start at Act 3.
Signature interaction: Send your name to Mars
The visitor's name is rebuilt from the same stars that formed the patch, then launched along the transfer arc to land on Mars.
1.  Idle. The button reads "Send your name". Hovering pulls a few nearby stars toward it, so the particles feel aware of the button.
2.  Input. Clicking opens an inline field (no modal). Max 20 characters.
3.  Assemble (about 1.2 s). On submit, about 1,500 stars peel off the background and spring into the letters of the name, centred above the button.
4.  Hold (about 0.6 s). The name glows. A small telemetry line appears: "Payload manifest updated: 1 name".
5.  Launch (about 2 s). The letters compress into a single bright point and travel the arc to Mars, leaving a fading trail.
6.  Land. A pin of light settles on the surface and keeps rotating with the planet. The button becomes "Your name flies with ARDENT" plus a share option.
Details that make it feel crafted
• Particles use springs, not tweens, so they overshoot slightly and settle. Nothing moves linearly.
• The landing glint persists (saved per visitor in local storage), so returning visitors see their name still there.
• Each launch nudges a live counter: "12,408 names aboard" (fictional, seeded number).
Accessibility and edge cases
• Keyboard: Tab to the button, Enter opens the field, Enter sends. Focus returns to the button afterwards.
• Screen readers: an aria-live message announces "Your name has been added to the ARDENT manifest."
• Reduced motion: skip assembly and flight. Fade the pin in on Mars and show the confirmation text.
• Empty or very long names: disable send when empty; long names shrink to fit one line.
• No WebGPU: the same flow runs on the static poster, with a CSS glint animating to the planet.
Art direction
The look is a 1970s NASA graphics manual updated for a dark, cinematic screen: strict grid, Swiss type, oxide red as the only warm colour.
Composition
• Mars is huge and cropped: about 120% of viewport height, sitting low-right so only its upper limb shows, like a horizon.
• Headline sits top-left on a 12-column grid, with plenty of empty black around it.
• HUD telemetry sits in the corners in small mono type: mission code, distance to Mars, window status.
• The transfer arc sweeps from bottom-left (off-screen Earth) to Mars, as a thin line of drifting particles.
Type
• Display: a tight grotesk set big and wide-tracked in caps (Inter Tight, Neue Haas Grotesk or Söhne Breit if licensed).
• Telemetry: a mono (JetBrains Mono or IBM Plex Mono) at 11 to 12 px, uppercase, tracked +8%.
• Two weights only. No italics.
Colour
Role
Name
Hex
Background
Void
#07070A
Planet and accent
Oxide
#C1440E
Atmosphere rim, glow
Dust
#E8B48A
Text
Bone
#F2EDE4
Quiet text, HUD
Ash
#8A857D
Motion principles
• Heavy and slow: big things move slowly, small things move quickly.
• Springs for particles, long ease-out curves for the camera. No bounce on type.
• One thing moves at a time during the intro, so the eye always knows where to look.
• After the intro, the scene keeps breathing: Mars rotates, stars drift, nothing loops obviously.
Mission patch
A circle containing the Mars disc, a single transfer arc and the word ARDENT, drawn as simple shapes. Original, not based on any real NASA insignia. It must read as a silhouette, because the particles have to form it.
References to study: the NASA Graphics Standards Manual (1975), Apple's product-launch hero pages, Active Theory's space work, and the vgpu earth and spiral-galaxy examples.
Copy deck
The headline sells the window, the subline sells the mission, and every number on screen is fictional but plausible.
Slot
Copy
Eyebrow (mono)
NASA / MISSION ARDENT / MARS TRANSFER
Headline
THE NEXT RED WINDOW
Subline
Every 26 months, Earth and Mars line up. ARDENT launches with the next one.
Live element
WINDOW OPENS IN · 726 DAYS (days large) · HH:MM:SS small in mono below
Primary button
Send your name
Secondary link
Read the mission brief
HUD top-right
ARDENT-01 · CREW 0 · CARGO 14 T
HUD bottom-left
DIST TO MARS 225,000,000 KM
HUD bottom-right
12,408 NAMES ABOARD
Confirmation
Your name flies with ARDENT.
Footer
Fictional mission concept. Not affiliated with NASA.
Countdown target: pick a fictional launch date in the late-2028 Mars window (for example 20 Nov 2028). Real agencies are targeting that window, so it reads as believable.
Alternative headlines: "Through the Red Window" · "Mars is 26 months away. Again." · "Built from stardust. Bound for Mars."
Technical approach
Start from two vgpu examples and layer them: earth becomes Mars underneath, and spiral-galaxy becomes the particle system on top.
Starting points
• npx vgpu examples pull earth --out ./ref/earth and npx vgpu examples pull spiral-galaxy --out ./ref/galaxy.
• Run npx vgpu mcp so Claude Code reads the vgpu docs and examples directly, rather than guessing the API.
• Run npx vgpu doctor early to confirm your machine is set up for WebGPU (npx vgpu check validates individual WGSL files).
Architecture
• Page layer (HTML/CSS): headline, countdown, button, HUD. Renders instantly and never waits for the GPU.
• Rendering (decided): one Gpu, one surface, one frame. Planet passes write into a shared HDR target, then particles (compute + additive instanced quads) draw into the same target, then one bloom chain and one composite/grade. No second canvas. Only the atmosphere rim, particles and pin bloom; the Mars body never blooms.
• Planet passes: the earth example regraded to Mars. Swap the albedo for an oxide palette, remove the ocean, night lights and clouds, keep the atmosphere as a thin dusty rim, and slow the rotation.
• Particle passes: rebuilt from the spiral-galaxy system. Its simulation is rewritten around a swappable target buffer (sky → patch → arc → name → point) driven by springs; the galaxy quad renderer, bloom and pointer input are reused.
• Points from shapes: draw the patch SVG or the typed name onto a hidden 2D canvas, sample the filled pixels, and pass those points to the GPU as the new targets. One function covers the patch and the name.
• The arc: a curve from bottom-left to the pin on Mars. Particles in "arc mode" travel along it with a little noise.
• The pin: a latitude and longitude on Mars, rotated with the planet and drawn as a small bloom spot.
Confirmed in the vgpu docs: one Gpu can drive several surfaces and canvases default to premultiplied alpha, but two transparent canvases would need two bloom chains and cannot add particle light over the planet. Decision: one surface; draw the planet first, then the particles.
Fallbacks and performance
• No WebGPU: show a poster image (a captured frame of the final state) and keep the button flow working.
• prefers-reduced-motion: skip the intro and flight, show the resting state.
• Use the adaptive-quality example's approach: start high, step down once on low FPS, low battery or a weak GPU.
• Cap device pixel ratio at 1.5 to 2, and pause rendering when the tab is hidden or the hero scrolls out of view.
• Mobile: fewer particles (about 2,000), Mars crops to the bottom half, HUD reduces to the countdown.
Scope and build order
Build one particle system that can take any target shape, because the intro, the arc and the name launch all depend on it.
Tier
What
Rough time
MVP
HTML headline, countdown, button, HUD, responsive layout, no-WebGPU poster
45 min
MVP
Particle layer with swappable targets: scattered stars to patch to arc
2 h
MVP
Mars hero regraded from earth, dust rim, ?tune panel, bloom threshold
2 h
Signature
Send your name: input, assemble, launch, land, pin persists
2 h
Polish
Timing pass, colour grade sliders, reduced motion, keyboard and screen reader
1 h
Stretch
Sound (a low drone, a soft tick on each countdown second, a whoosh on launch)
—
Stretch
Scroll from the hero into a mission-brief section along the arc
—
Stretch
Shareable card: "My name flies with ARDENT" with a still of the pin
—
Build order
1.  Lay out the static page first (type, grid, copy, poster image). It must look good with no GPU at all.
2.  Build the particle system: the rewritten sim with a swappable target buffer, sky → patch from a sampled SVG, pointer repel, hover pull toward the button.
3.  Get Mars rendering and graded. Expose colour, rim strength, rotation speed and bloom in a ?tune panel (plain inputs).
4.  Add the intro acts: patch-to-arc transition and Mars reveal timing, skip, return-visit start.
5.  Build the name flow, reusing step 2's sampling.
6.  Accessibility, fallbacks and the performance pass.
7.  Record the clip, then critique and polish.
Done, critique and publish
Day 2 is done when the name launch works end to end on a live URL and a 10-second clip shows it.
Definition of done
[ ] Live URL loads the static hero instantly and the GPU layers fade in
[ ] Intro runs once, in under 5 seconds, and can be skipped by scrolling or clicking
[ ] Send your name works with mouse, touch and keyboard, and the pin persists on reload
[ ] Reduced motion and no-WebGPU fallbacks verified in a real browser
[ ] Holds 60 fps on a laptop; checked on one phone
Critique questions before shipping
• At a glance, does Mars or the headline win? Only one should.
• Does the intro feel inevitable, or like a loading screen? If you'd skip it on a second visit, cut it to 3 seconds.
• Does the arc read as a trajectory without a label?
• Would a NASA comms person recognise this as their kind of page, minus the logo?
• Remove one element from the HUD. Is the page better?
Publish
• Clip: 10 seconds, starting on stars, ending on your own name landing on Mars.
• Post angle: "A hero section where the CTA is the animation. Your name is rebuilt from the same stardust that formed the mission patch, then flies to Mars."
• Build-log learning to name: sampling text into GPU particle targets, and layering two vgpu examples into one scene.