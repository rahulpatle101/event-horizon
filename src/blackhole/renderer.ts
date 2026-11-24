// Browser lifecycle for the baked black-hole pipeline.
// Adapted from the vgpu "optimized-black-hole" example (MIT, Copyright (c) 2025 Vercel, Inc.).
// Changes for EVENT HORIZON: pause/resume with on-demand frames, reduced-motion start,
// adaptive render scale with a pixel budget, framing presets (hero / observation),
// drag + keyboard orbit, and device-loss reporting. vgpu stays dynamically imported.

import type { Frame, Gpu, Surface } from "vgpu";

import bakeWgsl from "./bake.wgsl";
import bloomWgsl from "./bloom.wgsl";
import compositeWgsl from "./composite.wgsl";
import refineWgsl from "./refine.wgsl";
import shadeWgsl from "./shade.wgsl";
import {
  createEffects,
  createTargets,
  destroyTargets,
  prewarm,
  renderChain,
  setBakeUniforms,
  setBindings,
  setLensUniform,
  setPostUniforms,
  setShadeUniforms,
  type Effects,
  type Shaders,
  type Targets,
  type VgpuApi,
} from "./pipeline.ts";
import {
  applyFraming,
  defaultHeroSettings,
  FRAMINGS,
  type Framing,
  type FramingName,
} from "./settings.ts";

const SHADERS: Shaders = {
  bake: bakeWgsl,
  refine: refineWgsl,
  shade: shadeWgsl,
  bloom: bloomWgsl,
  composite: compositeWgsl,
};

const SCENE_YAW_TAU_S = 0.325;
const MAX_FRAME_DT_S = 0.1;
const MIN_FRAME_INTERVAL_MS = 1000 / 60 - 2;
const MOBILE_QUERY = "(max-width: 767px)";

/** Render scale steps used when frames are consistently slow. */
const QUALITY_STEPS = [1, 0.8, 0.65] as const;
const SLOW_FRAME_MS = 24;
const QUALITY_SAMPLE_FRAMES = 45;
/** Camera approach between arrival and observation (BLACKHOLE-REFERENCE.md). */
const MOTION_MS = 1200;
const MOTION_SCALE = 0.5;
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export type FailureReason = "unsupported" | "init" | "device-lost" | "runtime";

export interface RendererOptions {
  canvas: HTMLCanvasElement;
  paused: boolean;
  onFirstFrame?: () => void;
  onFailure?: (reason: FailureReason, error: unknown) => void;
}

export interface Renderer {
  ready: Promise<void>;
  setPaused(paused: boolean): void;
  /**
   * Switch between arrival and observation framing. With `animate`, the camera eases to the
   * new framing (re-baking at reduced resolution while it moves); the promise resolves once settled.
   */
  setObserving(observing: boolean, animate?: boolean): Promise<void>;
  /** Rotate the view azimuth (radians); used by drag and arrow keys in observation mode. */
  nudgeYaw(delta: number): void;
  /** The live camera (interpolated during moves), so overlays can project through the same view. */
  getView(): { centerX: number; centerY: number; cameraRoll: number; fov: number; sceneYaw: number };
  dispose(): void;
}

export function createRenderer(options: RendererOptions): Renderer {
  const { canvas } = options;
  const settings = defaultHeroSettings();
  const baseBloom = { ...settings.bloom };
  const mobileQuery = window.matchMedia(MOBILE_QUERY);

  let observing = false;
  let paused = options.paused;
  let disposed = false;
  let failed = false;

  let api: VgpuApi | undefined;
  let gpu: Gpu | undefined;
  let surface: Surface | undefined;
  let effects: Effects | undefined;
  let targets: Targets | undefined;
  let rafHandle = 0;
  let resizeObserver: ResizeObserver | undefined;
  let documentVisible = !document.hidden;

  let animationTime = 14; // matches the static poster frame
  let lastFrameAt: number | undefined;
  let lastPresentedAt: number | undefined;
  let lastYawAt: number | undefined;
  let forceBake = true;
  let dirty = true;
  let firstFramePresented = false;

  let pointerX = 0;
  let orbitYaw = 0;
  let currentSceneYaw = 0;

  let qualityIndex = 0;
  const frameSamples: number[] = [];
  let pendingResize = 0;

  const framingName = (): FramingName =>
    observing
      ? mobileQuery.matches ? "observeMobile" : "observe"
      : mobileQuery.matches ? "mobile" : "desktop";

  // --- camera motion ------------------------------------------------------

  interface Motion {
    from: Framing;
    to: Framing;
    start: number | undefined; // set on the first rendered frame
    resolve: () => void;
  }
  let motion: Motion | undefined;
  let motionTargets: Targets | undefined;

  const currentFraming = (): Framing => ({
    centerX: settings.centerX,
    centerY: settings.centerY,
    cameraRoll: settings.cameraRoll,
    fov: settings.fov,
    mouseYaw: settings.mouseYaw,
    copyMask: [...settings.copyMask],
    copyMaskStrength: settings.copyMaskStrength,
  });

  const applyLayout = () => {
    applyFraming(settings, FRAMINGS[framingName()]);
    if (effects) setLensUniform(effects, settings);
    forceBake = true;
    dirty = true;
  };
  applyLayout();

  /** End any camera move: jump to its destination and restore full-resolution targets. */
  const finishMotion = () => {
    const m = motion;
    if (!m) return;
    motion = undefined;
    applyFraming(settings, m.to);
    if (motionTargets) {
      const low = motionTargets;
      motionTargets = undefined;
      try {
        if (effects && targets) {
          setBindings(effects, targets);
          setPostUniforms(effects, targets, settings);
        }
        destroyTargets(low);
      } catch (error) {
        fail("runtime", error);
      }
    }
    if (effects) setLensUniform(effects, settings);
    forceBake = true;
    dirty = true;
    m.resolve();
  };

  /** Resolves when the current move (if any) settles. */
  const waitForMotion = (): Promise<void> =>
    new Promise<void>((resolve) => {
      if (!motion) return resolve();
      const m = motion;
      const previous = m.resolve;
      m.resolve = () => {
        previous();
        resolve();
      };
    });

  const startMotion = (to: Framing): Promise<void> =>
    new Promise<void>((resolve) => {
      if (motion) {
        const previous = motion;
        motion = undefined;
        previous.resolve();
      }
      const from = currentFraming();
      if (api && gpu && effects && targets && !motionTargets) {
        try {
          const size: [number, number] = [
            Math.max(1, Math.round(targets.gbuffer.size[0] * MOTION_SCALE)),
            Math.max(1, Math.round(targets.gbuffer.size[1] * MOTION_SCALE)),
          ];
          motionTargets = createTargets(api, gpu, size);
          const radius = settings.bloom.radius;
          settings.bloom.radius = radius * MOTION_SCALE; // same on-screen glow at lower resolution
          setBindings(effects, motionTargets);
          setPostUniforms(effects, motionTargets, settings);
          settings.bloom.radius = radius;
        } catch {
          motionTargets = undefined; // fall back to moving at full resolution
          if (effects && targets) setBindings(effects, targets);
        }
      }
      motion = { from, to, start: undefined, resolve };
      dirty = true;
    });

  // --- sizing -------------------------------------------------------------

  const surfaceDpr = () =>
    Math.min(Math.max(window.devicePixelRatio || 1, 1), mobileQuery.matches ? 1.5 : 1.75);

  /** Internal render size: CSS size × capped DPR × quality step, inside a pixel budget. */
  const renderSize = (): [number, number] => {
    const cssW = Math.max(1, canvas.clientWidth);
    const cssH = Math.max(1, canvas.clientHeight);
    let scale = surfaceDpr() * QUALITY_STEPS[qualityIndex]!;
    const budget = mobileQuery.matches ? 1.1e6 : 2.6e6;
    const pixels = cssW * cssH * scale * scale;
    if (pixels > budget) scale *= Math.sqrt(budget / pixels);
    return [Math.max(1, Math.round(cssW * scale)), Math.max(1, Math.round(cssH * scale))];
  };

  const applyBloomScale = (size: readonly [number, number]) => {
    const pxPerCss = size[0] / Math.max(1, canvas.clientWidth);
    const k = Math.min(Math.max(pxPerCss, 1), 2) / 2;
    settings.bloom.radius = baseBloom.radius * k;
    settings.bloom.strength = baseBloom.strength * k;
  };

  const rebuildTargets = () => {
    pendingResize = 0;
    if (disposed || failed || !api || !gpu || !effects || !targets) return;
    finishMotion(); // a resize mid-move snaps to the destination

    try {
      const size = renderSize();
      if (size[0] === targets.gbuffer.size[0] && size[1] === targets.gbuffer.size[1]) {
        dirty = true;
        return;
      }
      const next = createTargets(api, gpu, size);
      try {
        applyBloomScale(size);
        setBindings(effects, next);
        setPostUniforms(effects, next, settings);
      } catch (error) {
        destroyTargets(next);
        throw error;
      }
      const previous = targets;
      targets = next;
      destroyTargets(previous);
      forceBake = true;
      dirty = true;
    } catch (error) {
      fail("runtime", error);
    }
  };

  const scheduleResize = () => {
    if (!pendingResize) pendingResize = requestAnimationFrame(rebuildTargets);
  };

  // --- input --------------------------------------------------------------

  const onPointerMove = (event: PointerEvent) => {
    if (event.pointerType !== "mouse" || paused) return;
    pointerX = Math.min(1, Math.max(-1, (event.clientX / Math.max(window.innerWidth, 1)) * 2 - 1));
    if (settings.mouseYaw > 0) dirty = true;
  };
  const recenterPointer = () => {
    if (paused) return;
    pointerX = 0;
    dirty = true;
  };
  const onPointerOut = (event: PointerEvent) => {
    if (event.relatedTarget === null) recenterPointer();
  };
  const onVisibilityChange = () => {
    documentVisible = !document.hidden;
    if (!documentVisible) recenterPointer();
    reconcileLoop();
  };
  const onLayoutChange = () => {
    finishMotion();
    applyLayout();
    scheduleResize();
  };

  // --- frame loop ---------------------------------------------------------

  const yawTarget = () =>
    orbitYaw + (observing ? 0 : pointerX * Math.max(0, settings.mouseYaw));

  const advanceSceneYaw = (now: number): number => {
    const dt =
      lastYawAt === undefined ? 0 : Math.min(Math.max((now - lastYawAt) / 1000, 0), MAX_FRAME_DT_S);
    lastYawAt = now;
    const target = yawTarget();
    currentSceneYaw += (target - currentSceneYaw) * (1 - Math.exp(-dt / SCENE_YAW_TAU_S));
    if (Math.abs(target - currentSceneYaw) < 1e-4) currentSceneYaw = target;
    return currentSceneYaw;
  };

  const stepMotion = (now: number) => {
    const m = motion;
    if (!m) return;
    m.start ??= now;
    const t = Math.min(1, (now - m.start) / MOTION_MS);
    if (t >= 1) {
      finishMotion();
      return;
    }
    const e = easeInOut(t);
    settings.centerX = lerp(m.from.centerX, m.to.centerX, e);
    settings.centerY = lerp(m.from.centerY, m.to.centerY, e);
    settings.cameraRoll = lerp(m.from.cameraRoll, m.to.cameraRoll, e);
    settings.fov = lerp(m.from.fov, m.to.fov, e);
    settings.mouseYaw = lerp(m.from.mouseYaw, m.to.mouseYaw, e);
    settings.copyMaskStrength = lerp(m.from.copyMaskStrength, m.to.copyMaskStrength, e);
    settings.copyMask = m.from.copyMask.map((v, i) => lerp(v, m.to.copyMask[i]!, e)) as Framing["copyMask"];
    if (effects) setLensUniform(effects, settings);
    forceBake = true;
  };

  const renderFrame = (frame: Frame, now: number): void => {
    if (!effects || !targets || !surface) return;
    if (!paused && lastFrameAt !== undefined) {
      animationTime += Math.min(Math.max(0, (now - lastFrameAt) / 1000), MAX_FRAME_DT_S);
    }
    lastFrameAt = now;
    stepMotion(now);
    const active = motion && motionTargets ? motionTargets : targets;
    const runBake = forceBake;
    forceBake = false;
    if (runBake) setBakeUniforms(effects, active, settings);
    setShadeUniforms(effects, active, settings, animationTime, advanceSceneYaw(now));
    renderChain(frame, effects, active, surface, runBake);
  };

  const sampleQuality = (interval: number) => {
    if (paused || qualityIndex >= QUALITY_STEPS.length - 1) return;
    frameSamples.push(interval);
    if (frameSamples.length < QUALITY_SAMPLE_FRAMES) return;
    const sorted = [...frameSamples].sort((a, b) => a - b);
    frameSamples.length = 0;
    if (sorted[Math.floor(sorted.length / 2)]! > SLOW_FRAME_MS) {
      qualityIndex += 1;
      scheduleResize();
    }
  };

  const tick = (timestamp: number): void => {
    rafHandle = 0;
    if (disposed || failed || !api || !gpu) return;
    const yawSettling = Math.abs(yawTarget() - currentSceneYaw) > 1e-4;
    const wantsFrame = !paused || dirty || forceBake || yawSettling || Boolean(motion);
    if (wantsFrame && (lastPresentedAt === undefined || timestamp - lastPresentedAt >= MIN_FRAME_INTERVAL_MS)) {
      if (lastPresentedAt !== undefined && !forceBake && !motion) sampleQuality(timestamp - lastPresentedAt);
      lastPresentedAt = timestamp;
      dirty = false;
      try {
        const now = performance.now();
        api.frame(gpu, (frame) => renderFrame(frame, now));
      } catch (error) {
        fail("runtime", error);
        return;
      }
      if (!firstFramePresented) {
        firstFramePresented = true;
        options.onFirstFrame?.();
      }
    } else if (!wantsFrame) {
      // Idle while paused: keep the clock from jumping when motion resumes.
      lastFrameAt = undefined;
      lastYawAt = undefined;
      lastPresentedAt = undefined;
    }
    rafHandle = requestAnimationFrame(tick);
  };

  function reconcileLoop(): void {
    const shouldRun = !disposed && !failed && Boolean(gpu) && documentVisible;
    if (shouldRun && !rafHandle) {
      lastFrameAt = undefined;
      lastYawAt = undefined;
      lastPresentedAt = undefined;
      rafHandle = requestAnimationFrame(tick);
    } else if (!shouldRun && rafHandle) {
      cancelAnimationFrame(rafHandle);
      rafHandle = 0;
    }
  }

  // --- lifecycle ----------------------------------------------------------

  const removeListeners = () => {
    mobileQuery.removeEventListener("change", onLayoutChange);
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerout", onPointerOut);
    window.removeEventListener("blur", recenterPointer);
    document.removeEventListener("visibilitychange", onVisibilityChange);
    resizeObserver?.disconnect();
  };

  const releaseGpu = () => {
    if (rafHandle) cancelAnimationFrame(rafHandle);
    rafHandle = 0;
    if (pendingResize) cancelAnimationFrame(pendingResize);
    pendingResize = 0;
    try {
      gpu?.dispose(); // releases surface, targets, pipelines and the noise volume
    } catch {
      // Teardown must not mask the original failure.
    }
    gpu = undefined;
    surface = undefined;
    effects = undefined;
    targets = undefined;
  };

  function fail(reason: FailureReason, error: unknown): void {
    if (failed || disposed) return;
    failed = true;
    motion?.resolve();
    motion = undefined;
    motionTargets = undefined; // released with the device below
    removeListeners();
    releaseGpu();
    options.onFailure?.(reason, error);
  }

  const dispose = () => {
    if (disposed) return;
    disposed = true;
    motion?.resolve();
    motion = undefined;
    motionTargets = undefined;
    removeListeners();
    releaseGpu();
  };

  const initialize = async () => {
    if (!("gpu" in navigator) || !navigator.gpu) {
      fail("unsupported", new Error("navigator.gpu is unavailable"));
      return;
    }
    let vgpu: VgpuApi;
    let nextGpu: Gpu;
    try {
      vgpu = await import("vgpu");
      if (disposed) return;
      nextGpu = await vgpu.init({ powerPreference: "high-performance" });
    } catch (error) {
      fail("unsupported", error);
      return;
    }
    if (disposed) {
      nextGpu.dispose();
      return;
    }
    try {
      gpu = nextGpu;
      api = vgpu;
      surface = vgpu.surface(gpu, canvas, { dpr: surfaceDpr() });
      effects = createEffects(vgpu, gpu, SHADERS);
      const size = renderSize();
      targets = createTargets(vgpu, gpu, size);
      applyBloomScale(size);
      setBakeUniforms(effects, targets, settings);
      setShadeUniforms(effects, targets, settings, animationTime, 0);
      setBindings(effects, targets);
      setPostUniforms(effects, targets, settings);
      await prewarm(effects, targets, surface);
    } catch (error) {
      fail("init", error);
      return;
    }
    if (disposed || failed) return;

    void nextGpu.lost.then((info) => {
      if (!disposed && gpu === nextGpu) fail("device-lost", info);
    });
    nextGpu.onError((error) => fail("runtime", error));

    resizeObserver = new ResizeObserver(scheduleResize);
    resizeObserver.observe(canvas);
    mobileQuery.addEventListener("change", onLayoutChange);
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("pointerout", onPointerOut, { passive: true });
    window.addEventListener("blur", recenterPointer);
    document.addEventListener("visibilitychange", onVisibilityChange);
    documentVisible = !document.hidden;
    reconcileLoop();
  };

  const ready = initialize().catch((error: unknown) => fail("init", error));

  return {
    ready,
    setPaused(next) {
      if (next && settings.mouseYaw > 0 && !observing) {
        // Hold the camera exactly where it is: ambient pointer drift is motion too.
        pointerX = Math.min(1, Math.max(-1, (currentSceneYaw - orbitYaw) / settings.mouseYaw));
      }
      paused = next;
      frameSamples.length = 0;
      dirty = true;
    },
    setObserving(next, animate = false) {
      if (observing === next) return waitForMotion();
      observing = next;
      if (!next) orbitYaw = 0;
      const ready = Boolean(gpu && effects && targets) && !failed && !disposed;
      if (!animate || !ready) {
        finishMotion();
        currentSceneYaw = yawTarget(); // an instant framing change is a cut, not a pan
        applyLayout();
        return Promise.resolve();
      }
      return startMotion(FRAMINGS[framingName()]);
    },
    getView() {
      return {
        centerX: settings.centerX,
        centerY: settings.centerY,
        cameraRoll: settings.cameraRoll,
        fov: settings.fov,
        sceneYaw: currentSceneYaw,
      };
    },
    nudgeYaw(delta) {
      orbitYaw += delta;
      dirty = true;
    },
    dispose,
  };
}
