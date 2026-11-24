// Signature moment (ART_DIRECTION §8.6, §10): the spatial grid bends into a gravity well around the station
// and a nebula blooms *inside the warp only*. Transparent, premultiplied output over the void; the station
// SVG sits on top. Units: station units (viewBox -320..320) across the canvas.

struct Warp {
  amount: f32,   // 0..1 warp depth
  bloom: f32,    // 0..1 nebula intensity
  time: f32,
  gridAlpha: f32,
}

@group(0) @binding(0) var<uniform> warp: Warp;

const PULL: f32 = 0.42;   // keep in sync with field.ts
const SIGMA: f32 = 170.0;
const STEP: f32 = 40.0;
const LINE_LO: vec3f = vec3f(0.290, 0.310, 0.349);  // --line-lo #4A4F59 (display space)
const ION: vec3f = vec3f(0.231, 0.482, 1.0);        // --n-ion #3B7BFF
const PLASMA: vec3f = vec3f(1.0, 0.478, 0.184);     // --n-plasma #FF7A2F

fn hash(p: vec2f) -> f32 {
  return fract(sin(dot(p, vec2f(127.1, 311.7))) * 43758.5453);
}

fn noise(p: vec2f) -> f32 {
  let i = floor(p);
  let f = fract(p);
  let u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2f(1.0, 0.0)), u.x), mix(hash(i + vec2f(0.0, 1.0)), hash(i + vec2f(1.0, 1.0)), u.x), u.y);
}

fn fbm(p: vec2f) -> f32 {
  var v = 0.0;
  var a = 0.5;
  var q = p;
  for (var i = 0; i < 5; i++) {
    v += a * noise(q);
    q = q * 2.03 + vec2f(17.0, 9.0);
    a *= 0.5;
  }
  return v;
}

@fragment fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
  let p = (uv - vec2f(0.5)) * 640.0;
  let r = length(p);

  // Inverse of field.ts: find the source grid coordinate that the well pulled to this point.
  let f = PULL * warp.amount * exp(-(r * r) / (SIGMA * SIGMA));
  let q = p / max(1.0 - f, 0.2);

  // Anti-aliased 1px grid lines in the warped space.
  let cell = q / STEP;
  let d = abs(fract(cell - 0.5) - 0.5) / max(fwidth(cell), vec2f(1e-4));
  let line = 1.0 - min(min(d.x, d.y), 1.0);
  let fade = 1.0 - smoothstep(0.35 * 320.0, 320.0, r);
  let gridA = line * fade * warp.gridAlpha;

  // Nebula: only where the well is deep enough, slow fbm drift, ion ↔ plasma.
  let well = smoothstep(0.08, 0.6, f / PULL);
  let n = fbm(p * 0.012 + vec2f(warp.time * 0.03, -warp.time * 0.02));
  let wisps = smoothstep(0.42, 0.85, n);
  let hue = fbm(p * 0.006 + vec2f(3.1, warp.time * 0.015));
  let nebColor = mix(ION, PLASMA, smoothstep(0.35, 0.65, hue));
  let nebA = well * wisps * warp.bloom * 0.55;

  let color = LINE_LO * gridA + nebColor * nebA;
  let alpha = clamp(gridA + nebA, 0.0, 1.0);
  return vec4f(min(color, vec3f(alpha)), alpha);
}
