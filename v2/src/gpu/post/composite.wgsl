// ARDENT composite: scene + two-level bloom, soft filmic shoulder, display gamma.
// Task 2 output is premultiplied with alpha = brightest channel, so the canvas lays light over the
// static poster (Mars). Task 3 moves the planet into this frame and makes the output opaque.

struct Composite {
  glow: f32,
  exposure: f32,
}

@group(0) @binding(0) var scene: texture_2d<f32>;
@group(0) @binding(1) var near: texture_2d<f32>;
@group(0) @binding(2) var far: texture_2d<f32>;
@group(0) @binding(3) var samp: sampler;
@group(0) @binding(4) var<uniform> composite: Composite;

@fragment fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
  let base = textureSampleLevel(scene, samp, uv, 0.0).rgb;
  let bloom = textureSampleLevel(near, samp, uv, 0.0).rgb * 0.6 + textureSampleLevel(far, samp, uv, 0.0).rgb * 0.4;
  let hdr = base + bloom * composite.glow;
  let mapped = 1.0 - exp(-hdr * composite.exposure);
  let display = pow(clamp(mapped, vec3f(0.0), vec3f(1.0)), vec3f(1.0 / 2.2));
  let alpha = clamp(max(display.r, max(display.g, display.b)), 0.0, 1.0);
  return vec4f(display, alpha);
}
