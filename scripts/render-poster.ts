// Headless render of the real vgpu pipeline (Node + Dawn) to a PNG.
// Used to tune framing and to produce the static fallback poster.
//   node scripts/render-poster.ts <width> <height> <desktop|mobile|observe> <out.png> [time]
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PNG } from "pngjs";
import * as vgpu from "vgpu/node";
import { resolveShader } from "@vgpu/wgsl/runtime";
import { prepareShader } from "@vgpu/wgsl/prepare";

import {
  createEffects,
  createTargets,
  renderChain,
  setBakeUniforms,
  setBindings,
  setPostUniforms,
  setShadeUniforms,
  type Shaders,
  type VgpuApi,
} from "../src/blackhole/pipeline.ts";
import {
  applyFraming,
  defaultHeroSettings,
  FRAMINGS,
  type FramingName,
} from "../src/blackhole/settings.ts";

const [w = "1600", h = "900", framing = "desktop", out = "poster.png", t = "14"] =
  process.argv.slice(2);
const width = Number(w);
const height = Number(h);

async function load(name: string) {
  const entry = fileURLToPath(new URL(`../src/blackhole/${name}.wgsl`, import.meta.url));
  const resolved = await resolveShader({ entry });
  return prepareShader(resolved.wgsl);
}

const shaders: Shaders = {
  bake: await load("bake"),
  refine: await load("refine"),
  shade: await load("shade"),
  bloom: await load("bloom"),
  composite: await load("composite"),
};

const settings = defaultHeroSettings();
applyFraming(settings, FRAMINGS[framing as FramingName]);
// Match the live renderer's bloom scaling at its DPR cap (1.75 desktop, 1.5 mobile).
const bloomK = (/mobile/i.test(framing) ? 1.5 : 1.75) / 2;
settings.bloom.radius *= bloomK;
settings.bloom.strength *= bloomK;

const gpu = await vgpu.init();
const api = vgpu as unknown as VgpuApi;
const effects = createEffects(api, gpu, shaders);
const targets = createTargets(api, gpu, [width, height]);
const output = vgpu.target(gpu, { size: [width, height] });

setBakeUniforms(effects, targets, settings);
setShadeUniforms(effects, targets, settings, Number(t), 0);
setBindings(effects, targets);
setPostUniforms(effects, targets, settings);

const started = performance.now();
vgpu.frame(gpu, (frame) => renderChain(frame, effects, targets, output, true));
const pixels = await output.color.read({ mipLevel: 0, region: "all" });
const elapsed = performance.now() - started;

const png = new PNG({ width, height });
png.data.set(pixels);
writeFileSync(out, PNG.sync.write(png));

let lum = 0;
for (let i = 0; i < pixels.length; i += 4) lum += pixels[i]! + pixels[i + 1]! + pixels[i + 2]!;
console.log(
  JSON.stringify({ out, width, height, framing, ms: Math.round(elapsed), meanRGB: +(lum / (pixels.length * 0.75)).toFixed(2) })
);
gpu.dispose();
