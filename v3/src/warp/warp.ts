// vgpu renderer for the signature warp + nebula: one Gpu, one surface, one effect, rendered on demand
// (only while the lock moment animates, then one resting frame). vgpu loads dynamically so the page and
// the docking interaction never wait for it. Any failure falls back to the SVG warp.

import type { Effect, Gpu, Surface } from "vgpu";
import warpWgsl from "./warp.wgsl";

export interface WarpParams {
  amount: number;
  bloom: number;
  time: number;
  gridAlpha: number;
}

export interface WarpRenderer {
  render(params: WarpParams): void;
  dispose(): void;
}

export async function createWarpRenderer(
  canvas: HTMLCanvasElement,
  onFailure: (error: unknown) => void,
): Promise<WarpRenderer | undefined> {
  if (!("gpu" in navigator) || !navigator.gpu) return undefined;
  let gpu: Gpu | undefined;
  let surface: Surface | undefined;
  let effect: Effect | undefined;
  let failed = false;
  const fail = (error: unknown) => {
    if (failed) return;
    failed = true;
    try {
      gpu?.dispose();
    } catch {
      // keep the original failure
    }
    onFailure(error);
  };
  try {
    const vgpu = await import("vgpu");
    gpu = await vgpu.init();
    surface = vgpu.surface(gpu, canvas, { dpr: [1, 2], alphaMode: "premultiplied" });
    effect = vgpu.effect(gpu, warpWgsl, {
      label: "tessaly-warp",
      set: { warp: { amount: 0, bloom: 0, time: 0, gridAlpha: 0.5 } },
    });
    await effect.compile({ colors: [surface.format] });
    void gpu.lost.then((info) => fail(info));
    gpu.onError((error) => fail(error));
    const api = vgpu;
    return {
      render(params) {
        if (failed || !gpu || !surface || !effect) return;
        try {
          effect.set({ warp: params });
          api.frame(gpu, (f) => f.pass({ target: surface!, clear: [0, 0, 0, 0] }, (pass) => pass.draw(effect!)));
        } catch (error) {
          fail(error);
        }
      },
      dispose() {
        failed = true;
        try {
          gpu?.dispose();
        } catch {
          // already gone
        }
      },
    };
  } catch (error) {
    fail(error);
    return undefined;
  }
}
