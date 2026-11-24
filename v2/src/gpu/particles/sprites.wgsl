// Instanced quads for the particles, shaded as filtered points.
// Fragment shading adapted from the vgpu spiral-galaxy example (stars.wgsl, MIT, Copyright (c) 2025 Vercel, Inc.):
// a cubic-coverage core for sub-4px stars, a soft disc with faint cross rays for bright ones.
// The vertex stage is new: it reads the simulation state directly and applies ARDENT's rules
// (formation glow, planet occlusion, quiet stars behind the copy).

import { Params, followsTarget } from "./params.wgsl";

@group(0) @binding(0) var<storage, read> state: array<vec4f>;
@group(0) @binding(1) var<storage, read> attrs: array<vec4f>;
@group(0) @binding(2) var<storage, read> targets: array<vec4f>;
@group(0) @binding(3) var<uniform> params: Params;

const BONE: vec3f = vec3f(0.888, 0.843, 0.776);  // #F2EDE4, linear
const DUST: vec3f = vec3f(0.807, 0.456, 0.254);  // #E8B48A, linear

struct VertexOut {
  @builtin(position) position: vec4f,
  @location(0) local: vec2f,
  @location(1) diameter: f32,
  @location(2) brightness: f32,
  @location(3) color: vec3f,
  @location(4) opacity: f32,
  @location(5) rays: f32,
}

fn insideRect(p: vec2f, lo: vec2f, hi: vec2f, feather: f32) -> f32 {
  let d = max(lo - p, p - hi);
  return 1.0 - smoothstep(0.0, feather, max(d.x, d.y));
}

@vertex fn vs_main(@builtin(vertex_index) vertex: u32, @builtin(instance_index) instance: u32) -> VertexOut {
  var quad = array<vec2f, 6>(
    vec2f(-1.0, -1.0), vec2f(1.0, -1.0), vec2f(-1.0, 1.0),
    vec2f(-1.0, 1.0), vec2f(1.0, -1.0), vec2f(1.0, 1.0),
  );
  let corner = quad[vertex];
  let s = state[instance];
  let a0 = attrs[instance * 2u];
  let a1 = attrs[instance * 2u + 1u];
  let t = targets[instance];
  let p = s.xy;

  let forming = followsTarget(t.z, a1.z, params.formed, params.transitionAge);
  // Formation glow rises as a star settles onto its shape point.
  let settled = select(0.0, 1.0 - smoothstep(3.0, 70.0, distance(p, t.xy)), forming);
  let twinkle = 0.86 + 0.14 * sin(params.time * (0.6 + fract(a0.z * 5.3) * 1.4) + a0.z * 40.0);

  var opacity = 1.0;
  if (!forming) {
    // Sky stars never sit in front of the planet, and stay quiet behind the copy.
    let toPlanet = distance(p, params.planetCenter) - params.planetRadius;
    opacity *= smoothstep(-2.0, 6.0, toPlanet);
    let behindCopy = max(insideRect(p, params.copyMin, params.copyMax, 48.0),
                         insideRect(p, params.countMin, params.countMax, 36.0));
    opacity *= 1.0 - 0.72 * behindCopy;
  }

  let diameter = a0.w * params.sizeScale * params.pixelRatio * mix(1.0, 1.25, settled);
  // Stars bound for a shape wait dim in the sky and ignite as they assemble, so the void stays quiet.
  let waiting = select(1.0, 0.32, t.z > 0.5 && !forming);
  let brightness = a1.x * twinkle * waiting * mix(1.0, 1.7, settled);

  var out: VertexOut;
  out.local = corner;
  out.diameter = diameter;
  out.brightness = brightness;
  out.color = mix(BONE, DUST, a1.y);
  out.opacity = opacity;
  out.rays = select(0.0, 1.0, a1.x > 1.35);
  if (opacity <= 0.001 || diameter <= 0.0) {
    out.position = vec4f(2.0, 2.0, 0.0, 1.0); // degenerate: nothing to rasterise
    return out;
  }
  let ndc = vec2f(p.x / params.viewport.x * 2.0 - 1.0, 1.0 - p.y / params.viewport.y * 2.0);
  let size = max(diameter, 4.0);
  let resolution = params.viewport * params.pixelRatio;
  out.position = vec4f(ndc + corner * size / resolution, 0.0, 1.0);
  return out;
}

fn cubicCoverage(coordinate: f32) -> f32 {
  let x = abs(coordinate);
  if (x < 1.0) {
    return (4.0 - 6.0 * x * x + 3.0 * x * x * x) / 6.0;
  }
  let tail = max(2.0 - x, 0.0);
  return tail * tail * tail / 6.0;
}

fn filteredCore(pixel: vec2f, area: f32, diameter: f32) -> f32 {
  return cubicCoverage(pixel.x) * cubicCoverage(pixel.y) * area * diameter * diameter;
}

@fragment fn fs_main(in: VertexOut) -> @location(0) vec4f {
  let diameter = in.diameter;
  let pixel = in.local * 0.5 * max(diameter, 4.0);
  let point = pixel * 2.0 / max(diameter, 0.0001);
  let distanceToCenter = length(point);
  let disc = 1.0 - smoothstep(0.08, 1.0, distanceToCenter);
  let core = pow(disc, 2.2);
  let horizontalRay = exp(-abs(point.y) * 28.0) * (1.0 - smoothstep(0.18, 1.0, abs(point.x)));
  let verticalRay = exp(-abs(point.x) * 28.0) * (1.0 - smoothstep(0.18, 1.0, abs(point.y)));
  let rays = max(horizontalRay, verticalRay) * 0.22 * in.rays;
  let resolved = smoothstep(2.0, 4.0, diameter);
  let alpha = mix(filteredCore(pixel, 0.150904, diameter), max(core, rays), resolved) * in.opacity;
  if (alpha <= 0.0) {
    discard;
  }
  let whiteCore = mix(0.59228, core, resolved) * smoothstep(0.9, 2.8, in.brightness) * 0.82;
  let emission = mix(in.color, vec3f(1.0), whiteCore) * in.brightness;
  return vec4f(emission, alpha);
}
