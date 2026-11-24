// One thread per particle: a damped spring toward the current target (sky home or shape point),
// plus pointer repel and a gentle pull toward the Send button. Semi-implicit Euler with a speed cap.
// Written for ARDENT (V2); replaces the spiral-galaxy example's stroke-flow simulation.

import { Params, followsTarget, skyPosition } from "./params.wgsl";

@group(0) @binding(0) var<storage, read_write> state: array<vec4f>;
@group(0) @binding(1) var<storage, read> attrs: array<vec4f>;
@group(0) @binding(2) var<storage, read> targets: array<vec4f>;
@group(0) @binding(3) var<uniform> params: Params;

@compute @workgroup_size(64)
fn cs_main(@builtin(global_invocation_id) id: vec3u) {
  let i = id.x;
  if (f32(i) >= params.count) {
    return;
  }
  let a0 = attrs[i * 2u];
  let a1 = attrs[i * 2u + 1u];
  let t = targets[i];

  var goal = skyPosition(a0.xy, a0.z, params.time, params.viewport);
  if (followsTarget(t.z, a1.z, params.formed, params.transitionAge)) {
    goal = t.xy;
  }

  if (params.snap > 0.5) {
    state[i] = vec4f(goal, 0.0, 0.0);
    return;
  }

  var p = state[i].xy;
  var v = state[i].zw;
  let k = params.stiffness * a1.w;
  var acc = (goal - p) * k - v * params.damping;

  if (params.pointerActive > 0.5) {
    let d = p - params.pointer;
    let dist = length(d);
    if (dist < params.repelRadius && dist > 0.001) {
      let f = 1.0 - dist / params.repelRadius;
      acc += (d / dist) * params.repelStrength * f * f;
    }
  }

  if (params.pullActive > 0.5) {
    let d = params.pullCenter - p;
    let dist = length(d);
    if (dist < params.pullRadius && dist > 0.001) {
      acc += (d / dist) * params.pullStrength * (1.0 - dist / params.pullRadius);
    }
  }

  let dt = params.dt;
  v += acc * dt;
  let speed = length(v);
  if (speed > params.maxSpeed) {
    v *= params.maxSpeed / speed;
  }
  p += v * dt;
  state[i] = vec4f(p, v);
}
