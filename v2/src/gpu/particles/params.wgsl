// Shared per-frame parameters for the particle simulation and sprite pass.
// Positions are CSS pixels, origin top-left, y down.
export struct Params {
  viewport: vec2f,
  pointer: vec2f,
  pullCenter: vec2f,
  planetCenter: vec2f,
  copyMin: vec2f,
  copyMax: vec2f,
  countMin: vec2f,
  countMax: vec2f,
  planetRadius: f32,
  time: f32,
  dt: f32,
  stiffness: f32,
  damping: f32,
  repelRadius: f32,
  repelStrength: f32,
  pointerActive: f32,
  pullRadius: f32,
  pullStrength: f32,
  pullActive: f32,
  formed: f32,
  transitionAge: f32,
  snap: f32,
  sizeScale: f32,
  pixelRatio: f32,
  maxSpeed: f32,
  count: f32,
}

// attrs[2i]   = (homeX, homeY, seed, size)       home in 0..1 of the viewport, size in CSS px
// attrs[2i+1] = (brightness, tint, delay, kJitter)
// targets[i]  = (x, y, hasTarget, 0)              CSS px

/** Slow drift around a star's home point: stars breathe, nothing loops obviously. */
export fn skyPosition(home: vec2f, seed: f32, time: f32, viewport: vec2f) -> vec2f {
  let w1 = 0.05 + fract(seed * 7.13) * 0.07;
  let w2 = 0.04 + fract(seed * 3.71) * 0.06;
  let phase = seed * 6.2831;
  let amp = 4.0 + fract(seed * 11.7) * 7.0;
  return home * viewport + vec2f(sin(time * w1 + phase), cos(time * w2 + phase * 1.7)) * amp;
}

/** True when particle `i` should be following its target this frame. Departures are staggered by `delay`. */
export fn followsTarget(hasTarget: f32, delay: f32, formed: f32, age: f32) -> bool {
  if (hasTarget < 0.5) {
    return false;
  }
  if (formed > 0.5) {
    return age > delay; // joining: each star peels off after its own delay
  }
  return age < delay; // leaving: each star lets go after its own delay
}
