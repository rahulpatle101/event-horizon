// Combine bloom levels, tone map, vignette, and convert to display output.
// EVENT HORIZON adaptation: saturation is a uniform (params.y) instead of a
// fixed 0.0, and params.z adds a subtle warm grade for the amber disk.

// lens = (shadow centre u, v, chromatic fringe strength, unused).
struct Composite {
  params: vec4f,
  lens: vec4f,
}

@group(0) @binding(0) var<uniform> composite: Composite;
@group(0) @binding(1) var scene: texture_2d<f32>;
@group(0) @binding(2) var bloomNear: texture_2d<f32>;
@group(0) @binding(3) var bloomMedium: texture_2d<f32>;
@group(0) @binding(4) var bloomFar: texture_2d<f32>;
@group(0) @binding(5) var linearSampler: sampler;

const EXPOSURE: f32 = 1.15;

fn aces(x: vec3f) -> vec3f {
  let a = 2.51;
  let b = 0.03;
  let c = 2.43;
  let d = 0.59;
  let e = 0.14;
  return clamp((x * (a * x + vec3f(b))) / (x * (c * x + vec3f(d)) + vec3f(e)), vec3f(0.0), vec3f(1.0));
}

fn tonemap(linearColor: vec3f, uv: vec2f, saturation: f32, warmth: f32) -> vec3f {
  var color = aces(linearColor * EXPOSURE);

  let centered = uv - vec2f(0.5);
  let vignette = 1.0 - smoothstep(0.55, 1.15, length(centered) * 1.6);
  color *= mix(0.72, 1.0, vignette);

  color = pow(color, vec3f(1.0 / 2.2));
  let luma = dot(color, vec3f(0.2126, 0.7152, 0.0722));
  let graded = mix(vec3f(luma), color, saturation);
  // Lift highlights toward ivory and keep shadows neutral black.
  let warm = graded * mix(vec3f(1.0), vec3f(1.04, 0.98, 0.9), warmth * smoothstep(0.05, 0.9, luma));
  return clamp(warm, vec3f(0.0), vec3f(1.0));
}

fn sampleScene(uv: vec2f) -> vec3f {
  return textureSample(scene, linearSampler, uv).rgb;
}

fn sampleBloom(uv: vec2f) -> vec3f {
  // Wider, softer halo: more weight on the medium and far levels (BLACKHOLE-REFERENCE.md).
  return textureSample(bloomNear, linearSampler, uv).rgb * 0.36 +
    textureSample(bloomMedium, linearSampler, uv).rgb * 0.34 +
    textureSample(bloomFar, linearSampler, uv).rgb * 0.30;
}

@fragment fn fs_main(@location(0) uv: vec2f) -> @location(0) vec4f {
  // Radial chromatic fringe around the shadow centre: red out, blue in. The offset grows
  // with distance up to a cap so frame edges never smear.
  let size = vec2f(textureDimensions(scene));
  let aspect = size.x / max(size.y, 1.0);
  let d = (uv - composite.lens.xy) * vec2f(aspect, 1.0);
  let dist = length(d);
  let dir = select(vec2f(0.0), d / dist, dist > 1e-4);
  // Fade out away from the black hole so distant stars don't split into RGB dots.
  let amount = composite.lens.z * min(dist, 0.35) * (1.0 - smoothstep(0.3, 0.55, dist));
  let offset = dir * amount / vec2f(aspect, 1.0);

  let r = sampleScene(uv + offset).r;
  let g = sampleScene(uv).g;
  let b = sampleScene(uv - offset).b;
  let sceneColor = vec3f(r, g, b);
  let bloom = sampleBloom(uv);
  let hdr = sceneColor + bloom * composite.params.x;
  return vec4f(tonemap(hdr, uv, composite.params.y, composite.params.z), 1.0);
}
