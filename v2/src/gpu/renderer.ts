// ARDENT renderer: one Gpu, one surface, one frame.
// Task 2: particles (compute + additive instanced quads) → HDR scene → bloom → composite.
// Task 3 adds the planet passes in front of the particles into the same scene target.
// vgpu is imported dynamically so the page renders before any GPU code loads.

import type { Compute, Draw, Effect, Gpu, Surface, Target } from "vgpu";

import { MOBILE_QUERY, sceneGeometry } from "../layout.ts";
import { DEFAULT_FEEL, MAX_SPEED, MOBILE_COUNT_SCALE, PATCH_SHARE, type ParticleFeel } from "../settings.ts";
import patchSvg from "../patch.svg?raw";
import { installFieldInput, type FieldInput } from "./particles/input.ts";
import { createParticles, destroyParticles, release, writeTargets, type ParticleBuffers } from "./particles/particles.ts";
import { drawFromSvg, samplePoints, type Draw2D } from "./particles/targets.ts";
import simulateWgsl from "./particles/simulate.wgsl";
import spritesWgsl from "./particles/sprites.wgsl";
import brightWgsl from "./post/bright.wgsl";
import blurWgsl from "./post/blur.wgsl";
import compositeWgsl from "./post/composite.wgsl";

type VgpuApi = typeof import("vgpu");

const MAX_DPR = 1.75;
const SCENE_FORMAT = "rgba16float" as const;
const WORKGROUP = 64;
const CLEAR = [0, 0, 0, 0] as const;
const MAX_DT = 1 / 30;
const BLURS = [
  { direction: [1, 0], radius: 1.4 },
  { direction: [0, 1], radius: 1.4 },
  { direction: [1, 0], radius: 2.2 },
  { direction: [0, 1], radius: 2.2 },
] as const;

export type FailureReason = "unsupported" | "init" | "device-lost" | "runtime";

export interface RendererOptions {
  canvas: HTMLCanvasElement;
  /** Live feel values; mutated by the ?tune panel. */
  feel: ParticleFeel;
  pullTarget: HTMLElement;
  /** Elements whose boxes dim the sky stars behind them (copy, countdown). */
  quiet: [HTMLElement, HTMLElement];
  reducedMotion: boolean;
  onLive?: () => void;
  onFailure?: (reason: FailureReason, error: unknown) => void;
}

export interface Renderer {
  ready: Promise<void>;
  /** Form the patch (true) or release to the sky (false). */
  setFormed(formed: boolean): void;
  readonly formed: boolean;
  /** Recreate particles (after a count change in ?tune). */
  rebuild(): void;
  dispose(): void;
}

interface Post {
  scene: Target;
  near: [Target, Target];
  far: [Target, Target];
}

export function createRenderer(options: RendererOptions): Renderer {
  const { canvas, feel } = options;
  const mobileQuery = matchMedia(MOBILE_QUERY);

  let api: VgpuApi | undefined;
  let gpu: Gpu | undefined;
  let surface: Surface | undefined;
  let particles: ParticleBuffers | undefined;
  let sim: Compute | undefined;
  let sprites: Draw | undefined;
  let bright: Effect | undefined;
  let blurs: Effect[] = [];
  let composite: Effect | undefined;
  let post: Post | undefined;
  let input: FieldInput | undefined;
  let patchDraw: Draw2D | undefined;

  let disposed = false;
  let failed = false;
  let live = false;
  let raf = 0;
  let visible = !document.hidden;
  let inView = true;
  let intersection: IntersectionObserver | undefined;
  let resizeTimer = 0;

  let formed = false;
  let toggledAt = 0;
  let snapNext = options.reducedMotion;
  let time = 0;
  let last: number | undefined;
  let viewport: [number, number] = [1, 1];
  let pixelRatio = 1;

  const particleCount = () =>
    Math.max(256, Math.round(feel.count * (mobileQuery.matches ? MOBILE_COUNT_SCALE : 1)));

  // ------------------------------------------------------------ resources

  function geometry() {
    return sceneGeometry(viewport[0], viewport[1], mobileQuery.matches);
  }

  function buildParticles(): void {
    if (!api || !gpu) return;
    const old = particles;
    const g = geometry();
    particles = createParticles(gpu, particleCount(), {
      width: viewport[0],
      height: viewport[1],
      avoid: g.planet,
    });
    const shared = { state: particles.state, attrs: particles.attrs, targets: particles.targets };
    sim = api.compute(gpu, simulateWgsl, { label: "ardent-simulate", set: { ...shared, params: paramsFor(0) } });
    sprites = api.draw(gpu, {
      shader: spritesWgsl,
      vertices: 6,
      instances: particles.count,
      label: "ardent-sprites",
      blend: { color: { src: "src-alpha", dst: "one" }, alpha: { src: "one", dst: "one-minus-src-alpha" } },
      set: { ...shared, params: paramsFor(0) },
    });
    if (old) destroyParticles(old);
    writePatchTargets();
  }

  function writePatchTargets(): void {
    if (!particles || !patchDraw) return;
    const { patch } = geometry();
    const n = Math.round(particles.count * PATCH_SHARE);
    const grid = 400;
    const raw = samplePoints(patchDraw, n, grid);
    const points = new Float32Array(raw.length);
    for (let i = 0; i < n; i++) {
      points[i * 2] = patch.cx + (raw[i * 2]! / grid - 0.5) * patch.size;
      points[i * 2 + 1] = patch.cy + (raw[i * 2 + 1]! / grid - 0.5) * patch.size;
    }
    writeTargets(particles, points, [patch.cx, patch.cy], viewport);
  }

  function buildPost(size: readonly [number, number]): void {
    if (!api || !gpu) return;
    const make = (s: [number, number], label: string) =>
      api!.target(gpu!, { size: s, format: SCENE_FORMAT, label });
    const full: [number, number] = [Math.max(1, size[0]), Math.max(1, size[1])];
    const half: [number, number] = [Math.max(1, full[0] >> 1), Math.max(1, full[1] >> 1)];
    const quarter: [number, number] = [Math.max(1, full[0] >> 2), Math.max(1, full[1] >> 2)];
    const next: Post = {
      scene: make(full, "ardent-scene"),
      near: [make(half, "ardent-near-a"), make(half, "ardent-near-b")],
      far: [make(quarter, "ardent-far-a"), make(quarter, "ardent-far-b")],
    };
    bright!.set({ src: next.scene });
    blurs[0]!.set({ src: next.near[0], blur: { texelSize: next.near[0].texelSize } });
    blurs[1]!.set({ src: next.near[1], blur: { texelSize: next.near[1].texelSize } });
    blurs[2]!.set({ src: next.near[0], blur: { texelSize: next.near[0].texelSize } });
    blurs[3]!.set({ src: next.far[0], blur: { texelSize: next.far[0].texelSize } });
    composite!.set({ scene: next.scene, near: next.near[0], far: next.far[1] });
    const old = post;
    post = next;
    if (old) for (const t of [old.scene, ...old.near, ...old.far]) release(t);
  }

  // --------------------------------------------------------------- params

  function rectIn(el: HTMLElement): { min: [number, number]; max: [number, number] } {
    const c = canvas.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    return { min: [r.left - c.left, r.top - c.top], max: [r.right - c.left, r.bottom - c.top] };
  }

  function paramsFor(dt: number) {
    const g = geometry();
    const copy = rectIn(options.quiet[0]);
    const count = rectIn(options.quiet[1]);
    const pointer = input?.state.pointer;
    const pull = input?.state.pull;
    return {
      viewport,
      pointer: pointer ?? [-9999, -9999],
      pullCenter: pull ?? [-9999, -9999],
      planetCenter: [g.planet.cx, g.planet.cy],
      copyMin: copy.min,
      copyMax: copy.max,
      countMin: count.min,
      countMax: count.max,
      planetRadius: g.planet.r,
      time,
      dt,
      stiffness: feel.stiffness,
      damping: feel.damping,
      repelRadius: feel.repelRadius,
      repelStrength: feel.repelStrength,
      pointerActive: pointer ? 1 : 0,
      pullRadius: feel.pullRadius,
      pullStrength: feel.pullStrength,
      pullActive: pull ? 1 : 0,
      formed: formed ? 1 : 0,
      transitionAge: time - toggledAt,
      snap: snapNext ? 1 : 0,
      sizeScale: feel.size,
      pixelRatio,
      maxSpeed: MAX_SPEED,
      count: particles?.count ?? 0,
    };
  }

  // ----------------------------------------------------------------- loop

  function renderFrame(now: number): void {
    if (!api || !gpu || !surface || !sim || !sprites || !post || !particles) return;
    const dt = last === undefined ? 0 : Math.min(MAX_DT, Math.max(0, (now - last) / 1000));
    last = now;
    time += dt;
    const params = paramsFor(dt);
    snapNext = false;
    sim.set({ params });
    sprites.set({ params });
    composite!.set({ composite: { glow: feel.glow, exposure: 1.35 } });
    const p = post;
    const count = particles.count;
    api.frame(gpu, (f) => {
      f.computePass((pass) => pass.dispatch(sim!, Math.ceil(count / WORKGROUP)));
      f.pass({ target: p.scene, clear: CLEAR }, (pass) => pass.draw(sprites!));
      f.pass({ target: p.near[0], clear: CLEAR }, (pass) => pass.draw(bright!));
      f.pass({ target: p.near[1], clear: CLEAR }, (pass) => pass.draw(blurs[0]!));
      f.pass({ target: p.near[0], clear: CLEAR }, (pass) => pass.draw(blurs[1]!));
      f.pass({ target: p.far[0], clear: CLEAR }, (pass) => pass.draw(blurs[2]!));
      f.pass({ target: p.far[1], clear: CLEAR }, (pass) => pass.draw(blurs[3]!));
      f.pass({ target: surface!, clear: CLEAR }, (pass) => pass.draw(composite!));
    });
    if (!live) {
      live = true;
      options.onLive?.();
    }
  }

  const tick = (now: number) => {
    raf = 0;
    if (disposed || failed) return;
    try {
      renderFrame(now);
    } catch (error) {
      fail("runtime", error);
      return;
    }
    raf = requestAnimationFrame(tick);
  };

  function reconcile(): void {
    const run = !disposed && !failed && Boolean(gpu) && visible && inView;
    if (run && !raf) {
      last = undefined;
      raf = requestAnimationFrame(tick);
    } else if (!run && raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  }

  const onVisibility = () => {
    visible = !document.hidden;
    reconcile();
  };
  const onLayout = () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      if (!particles) return;
      // Breakpoint changes alter the particle budget; otherwise just re-aim the targets.
      if (particles.count !== particleCount()) buildParticles();
      else writePatchTargets();
    }, 150);
  };

  // ------------------------------------------------------------ lifecycle

  function teardown(): void {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    window.clearTimeout(resizeTimer);
    input?.dispose();
    intersection?.disconnect();
    document.removeEventListener("visibilitychange", onVisibility);
    mobileQuery.removeEventListener("change", onLayout);
    try {
      gpu?.dispose(); // releases surface, targets, buffers, pipelines
    } catch {
      // Teardown must not mask the original failure.
    }
    gpu = undefined;
  }

  function fail(reason: FailureReason, error: unknown): void {
    if (failed || disposed) return;
    failed = true;
    teardown();
    options.onFailure?.(reason, error);
  }

  async function initialize(): Promise<void> {
    if (!("gpu" in navigator) || !navigator.gpu) {
      fail("unsupported", new Error("navigator.gpu is unavailable"));
      return;
    }
    let vgpu: VgpuApi;
    let device: Gpu;
    try {
      vgpu = await import("vgpu");
      device = await vgpu.init({ powerPreference: "high-performance" });
    } catch (error) {
      fail("unsupported", error);
      return;
    }
    if (disposed) {
      device.dispose();
      return;
    }
    try {
      api = vgpu;
      gpu = device;
      patchDraw = await drawFromSvg(patchSvg, '"Inter Tight Variable", "Inter Tight", sans-serif');
      if (disposed || failed) return;
      surface = vgpu.surface(device, canvas, { dpr: [1, MAX_DPR], alphaMode: "premultiplied" });
      const samp = vgpu.sampler(device, {
        minFilter: "linear",
        magFilter: "linear",
        addressModeU: "clamp-to-edge",
        addressModeV: "clamp-to-edge",
      });
      bright = vgpu.effect(device, brightWgsl, { label: "ardent-bright", set: { samp, bright: { threshold: 0.22, smoothing: 0.6 } } });
      blurs = BLURS.map((b, i) =>
        vgpu.effect(device, blurWgsl, { label: `ardent-blur-${i}`, set: { samp, blur: { ...b, texelSize: [1, 1] } } }),
      );
      composite = vgpu.effect(device, compositeWgsl, {
        label: "ardent-composite",
        set: { samp, composite: { glow: feel.glow, exposure: 1.35 } },
      });
      viewport = [Math.max(1, canvas.clientWidth), Math.max(1, canvas.clientHeight)];
      surface.onResize(({ width, height, dpr }) => {
        pixelRatio = dpr;
        viewport = [Math.max(1, canvas.clientWidth), Math.max(1, canvas.clientHeight)];
        buildPost([width, height]);
        if (particles) onLayout();
      });
      input = installFieldInput(canvas, options.pullTarget);
      buildParticles();
    } catch (error) {
      fail("init", error);
      return;
    }

    void device.lost.then((info) => {
      if (!disposed && gpu === device) fail("device-lost", info);
    });
    device.onError((error) => fail("runtime", error));
    document.addEventListener("visibilitychange", onVisibility);
    mobileQuery.addEventListener("change", onLayout);
    intersection = new IntersectionObserver((entries) => {
      inView = entries.at(-1)?.isIntersecting ?? inView;
      reconcile();
    });
    intersection.observe(canvas);
    reconcile();
  }

  const ready = initialize().catch((error: unknown) => fail("init", error));

  return {
    ready,
    get formed() {
      return formed;
    },
    setFormed(next) {
      if (next === formed) return;
      formed = next;
      toggledAt = time;
      if (options.reducedMotion) snapNext = true;
    },
    rebuild() {
      if (gpu && !failed) buildParticles();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      teardown();
    },
  };
}
