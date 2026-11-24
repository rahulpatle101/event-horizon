export interface DiskLook {
  brightness: number;
  speed: number;
  stretch: number;
  detail: number;
  turbulence: number;
  density: number;
  doppler: number;
  cloudScale: number;
  cloudSpeed: number;
  cloudStrength: number;
  spare0: number;
  spare1: number;
  spare2: number;
  spare3: number;
}

export interface StarLook {
  brightness: number;
  density: number;
  contrast: number;
  warmth: number;
  twinkle: number;
}

export interface BloomLook {
  strength: number;
  threshold: number;
  knee: number;
  radius: number;
}

export interface GradeLook {
  saturation: number;
  warmth: number;
  /** Chromatic fringe strength (uv offset per unit of distance from the shadow centre). */
  fringe: number;
}

export interface Framing {
  centerX: number;
  centerY: number;
  cameraRoll: number;
  fov: number;
  mouseYaw: number;
  /** Star attenuation behind the copy: [cx, cy, rx, ry] in uv, plus strength. */
  copyMask: [number, number, number, number];
  copyMaskStrength: number;
}

export interface HeroSettings {
  cameraY: number;
  distance: number;
  diskRadius: number;
  fov: number;
  centerX: number;
  centerY: number;
  cameraRoll: number;
  mouseYaw: number;
  centerFade: number;
  copyMask: [number, number, number, number];
  copyMaskStrength: number;
  bloom: BloomLook;
  grade: GradeLook;
  disk: DiskLook;
  stars: StarLook;
}

// Adapted from the vgpu "optimized-black-hole" example (MIT, Copyright (c) 2025 Vercel, Inc.).

/** Shared deterministic production defaults for the browser and headless renderer. */
export function defaultHeroSettings(): HeroSettings {
  return {
    cameraY: 0.16,
    distance: 13.5,
    diskRadius: 9,
    fov: 3,
    centerX: 0.8,
    centerY: 0.3,
    cameraRoll: -0.27,
    mouseYaw: 0.15,
    centerFade: 0,
    copyMask: [0.5, 0.5, 1, 1],
    copyMaskStrength: 0,
    bloom: { strength: 0.95, threshold: 0, knee: 0.18, radius: 2.1 },
    grade: { saturation: 0.55, warmth: 0.45, fringe: 0.017 },
    disk: {
      brightness: 0.58,
      speed: 0.75,
      stretch: 3.2,
      detail: 6,
      turbulence: 0.9,
      density: 1.35,
      doppler: 1.21,
      cloudScale: 20,
      cloudSpeed: 0.3,
      cloudStrength: 0.0,
      spare0: 0.43,
      spare1: -0.25,
      spare2: -0.58,
      spare3: -0.35,
    },
    stars: { brightness: 0.95, density: 1, contrast: 13, warmth: 0.9, twinkle: 0 },
  };
}

/** EVENT HORIZON hero framings. NDC offsets place the shadow relative to the copy. */
export const FRAMINGS = {
  desktop: {
    centerX: 0.47, centerY: 0.02, cameraRoll: -0.34, fov: 1.95, mouseYaw: 0.1,
    copyMask: [0.2, 0.6, 0.36, 0.5], copyMaskStrength: 0.88,
  },
  mobile: {
    centerX: 0, centerY: 0.4, cameraRoll: -0.14, fov: 1.05, mouseYaw: 0,
    copyMask: [0.5, 0.8, 0.9, 0.38], copyMaskStrength: 0.85,
  },
  // Observe framings leave room for the bottom instrument console.
  observe: {
    centerX: 0, centerY: 0.15, cameraRoll: -0.16, fov: 2.0, mouseYaw: 0.5,
    copyMask: [0.5, 0.5, 1, 1], copyMaskStrength: 0,
  },
  observeMobile: {
    centerX: 0, centerY: 0.52, cameraRoll: -0.14, fov: 1.05, mouseYaw: 0,
    copyMask: [0.5, 0.5, 1, 1], copyMaskStrength: 0,
  },
} satisfies Record<string, Framing>;

export type FramingName = keyof typeof FRAMINGS;

export function applyFraming(settings: HeroSettings, framing: Framing): void {
  settings.centerX = framing.centerX;
  settings.centerY = framing.centerY;
  settings.cameraRoll = framing.cameraRoll;
  settings.fov = framing.fov;
  settings.mouseYaw = framing.mouseYaw;
  settings.copyMask = [...framing.copyMask];
  settings.copyMaskStrength = framing.copyMaskStrength;
}
