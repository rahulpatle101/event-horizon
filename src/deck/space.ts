// The living environment outside the observation window (Canvas 2D overlay, above the vgpu scene,
// below the copy). Depth layers, far → near:
//   hero stars  — a few distinctive bright stars with restrained halos, projected through the live camera
//   near dust   — faint out-of-focus motes drifting one way (the vessel is moving), nearer = faster
//   encounters  — a rare tumbling debris shard and an even rarer relay probe, on paths that never cross
//                 the black hole's silhouette
// Plus rim light on the window aperture where passing objects catch the light.
// These are the vessel's local surroundings. Their motion is illustrative; it doesn't model
// trajectories near the black hole.

export interface View {
  centerX: number;
  centerY: number;
  cameraRoll: number;
  fov: number;
  sceneYaw: number;
}

interface Circle {
  cx: number;
  cy: number;
  r: number;
}

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface SpaceOptions {
  canvas: HTMLCanvasElement;
  rim: HTMLCanvasElement;
  view(): View;
  blackHole(view: View, w: number, h: number): Circle;
  quiet(): Box[];
  window(): Box & { radius: number };
  reducedMotion(): boolean;
  onFlyby(kind: "debris" | "probe", pan: number, intensity: number): void;
}

export interface Space {
  /** 0..1 environment level; dims dust and pauses new encounters during signature moments. */
  setLevel(level: number): void;
  setPointer(nx: number, ny: number): void;
  /** Pause motion: freeze on the current frame; encounter clocks shift on resume so nothing jumps. */
  setPaused(paused: boolean): void;
  readonly quality: number;
  /** Test hook: spawn an encounter now. */
  spawn(kind: "debris" | "probe"): boolean;
  /** Test hook: current encounter positions (CSS px). */
  positions(): { kind: string; x: number; y: number; size: number }[];
  dispose(): void;
}

// Hero stars: placed in open sky in the arrival framing (1440×900 reference), stored as camera-space
// directions so any framing, yaw or camera move projects them consistently with the shader's sky.
const HERO_PX: { x: number; y: number; temp: "warm" | "cool" | "white"; mag: number; scint: boolean }[] = [
  { x: 1248, y: 118, temp: "cool", mag: 1, scint: true },
  { x: 668, y: 128, temp: "warm", mag: 0.75, scint: false },
  { x: 1392, y: 610, temp: "white", mag: 0.6, scint: false },
  { x: 760, y: 772, temp: "warm", mag: 0.85, scint: true },
  { x: 942, y: 792, temp: "cool", mag: 0.55, scint: false },
];
const REF = { w: 1440, h: 900, centerX: 0.47, centerY: 0.02, cameraRoll: -0.34, fov: 1.95 };
const TEMP = { warm: [255, 214, 170], cool: [196, 216, 255], white: [246, 242, 232] } as const;
const VESSEL_DRIFT: [number, number] = [-12, 3.5]; // px/s at depth 1: the vessel moves right, slightly up

const rot = (x: number, y: number, a: number): [number, number] => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];

function heroDirections() {
  return HERO_PX.map((h) => {
    const px = (h.x - (REF.w / 2) * (1 + REF.centerX)) / (REF.h / 2);
    const py = -(h.y - (REF.h / 2) * (1 - REF.centerY)) / (REF.h / 2);
    const [rx, ry] = rot(px, py, REF.cameraRoll);
    return { ...h, sx: rx / REF.fov, sy: ry / REF.fov };
  });
}

function project(sx: number, sy: number, v: View, w: number, h: number): [number, number] {
  // Yaw turns the distant sky horizontally (small-angle), then the camera roll and framing apply.
  const yawed = sx - v.sceneYaw;
  const [px, py] = rot(yawed * v.fov, sy * v.fov, -v.cameraRoll);
  return [(w / 2) * (1 + v.centerX) + px * (h / 2), (h / 2) * (1 - v.centerY) - py * (h / 2)];
}

const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

interface Mote {
  x: number;
  y: number;
  z: number;
}

interface Encounter {
  kind: "debris" | "probe";
  start: number;
  duration: number;
  from: [number, number];
  to: [number, number];
  size: number;
  spin: number;
  shape: [number, number][];
  cued: boolean;
}

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createSpace(options: SpaceOptions): Space {
  const { canvas, rim } = options;
  const ctx = canvas.getContext("2d")!;
  const rctx = rim.getContext("2d")!;
  const heroes = heroDirections();
  const random = rng(Date.now() & 0xffff);
  let w = 1;
  let h = 1;
  let dpr = 1;
  let level = 1;
  let shownLevel = 1;
  let quality = matchMedia("(max-width: 767px)").matches ? 1 : 0; // 0 full, 1 reduced, 2 minimal
  const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
  let motes: Mote[] = [];
  const encounters: Encounter[] = [];
  let nextDebris = performance.now() + 12000 + random() * 6000;
  let nextProbe = performance.now() + 45000;
  let raf = 0;
  let last = performance.now();
  let lastFov: number | undefined;
  const frameTimes: number[] = [];
  let paused = false;
  let pausedAt = 0;

  function resize(): void {
    dpr = Math.min(1.5, window.devicePixelRatio || 1);
    w = canvas.clientWidth || window.innerWidth;
    h = canvas.clientHeight || window.innerHeight;
    for (const c of [canvas, rim]) {
      c.width = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
    }
    seedMotes();
  }

  function seedMotes(): void {
    const count = [28, 14, 0][quality]!;
    motes = Array.from({ length: count }, () => ({ x: random() * w, y: random() * h, z: 0.25 + random() * 0.75 }));
  }

  /** Returns false when no clean path exists right now (the caller retries later). */
  function spawn(kind: "debris" | "probe", now = performance.now()): boolean {
    if (options.reducedMotion()) return false; // no flybys under reduced motion, from any caller
    const v = options.view();
    const bh = options.blackHole(v, w, h);
    // Copy and controls stay calm: encounters never pass behind them.
    const quiet = options.quiet().map((b) => ({ x: b.x - 12, y: b.y - 12, w: b.w + 24, h: b.h + 24 }));
    // Choose a straight path that keeps well clear of the black hole's silhouette: a random safe point,
    // a direction near the vessel's drift (debris) or across the upper sky (probe), clipped to the screen.
    for (let attempt = 0; attempt < 150; attempt++) {
      const px = random() * w;
      const py = kind === "probe" ? (0.08 + random() * 0.12) * h : random() * h;
      const leftward = random() < (kind === "debris" ? 0.8 : 0.5);
      const spread = kind === "probe" ? 0.08 : 0.9; // radians either side
      const theta = (leftward ? Math.PI : 0) + (random() * 2 - 1) * spread;
      const dx = Math.cos(theta);
      const dy = Math.sin(theta);
      // Extend the line through (px, py) to just beyond the screen edges.
      const reach = Math.hypot(w, h);
      const from: [number, number] = [px - dx * reach, py - dy * reach];
      const to: [number, number] = [px + dx * reach, py + dy * reach];
      const clip = (t0: number, t1: number) => {
        let lo = t0;
        let hi = t1;
        for (const [p0, d, min, max] of [[from[0], to[0] - from[0], -60, w + 60], [from[1], to[1] - from[1], -60, h + 60]] as const) {
          if (Math.abs(d) < 1e-6) continue;
          const a1 = (min - p0) / d;
          const a2 = (max - p0) / d;
          lo = Math.max(lo, Math.min(a1, a2));
          hi = Math.min(hi, Math.max(a1, a2));
        }
        return [lo, hi] as const;
      };
      const [lo, hi] = clip(0, 1);
      if (hi <= lo) continue;
      const a0: [number, number] = [from[0] + (to[0] - from[0]) * lo, from[1] + (to[1] - from[1]) * lo];
      const a1: [number, number] = [from[0] + (to[0] - from[0]) * hi, from[1] + (to[1] - from[1]) * hi];
      let clear = true;
      for (let t = 0; t <= 1; t += 0.04) {
        const x = a0[0] + (a1[0] - a0[0]) * t;
        const y = a0[1] + (a1[1] - a0[1]) * t;
        if (Math.hypot(x - bh.cx, y - bh.cy) < bh.r * 1.15 || quiet.some((b) => x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h)) {
          clear = false;
          break;
        }
      }
      if (!clear) continue;
      const from2 = a0;
      const to2 = a1;
      const size = kind === "probe" ? 1 : 7 + random() * 9;
      const shape: [number, number][] = Array.from({ length: 7 }, (_, i) => {
        const a = (i / 7) * Math.PI * 2 + random() * 0.5;
        const r = 0.55 + random() * 0.45;
        return [Math.cos(a) * r, Math.sin(a) * r * (0.6 + random() * 0.4)];
      });
      encounters.push({
        kind,
        start: now,
        duration: kind === "probe" ? 26000 + random() * 8000 : 4200 + random() * 1800,
        from: from2,
        to: to2,
        size,
        spin: (random() < 0.5 ? -1 : 1) * (0.6 + random()),
        shape,
        cued: false,
      });
      return true;
    }
    return false;
  }

  // ----------------------------------------------------------------- draw

  function drawHeroes(v: View, now: number, quiet: Box[], bh: Circle): void {
    const rm = options.reducedMotion();
    for (const [i, s] of heroes.entries()) {
      let [x, y] = project(s.sx, s.sy, v, w, h);
      if (!rm) {
        x += pointer.sx * 3;
        y += pointer.sy * 3;
      }
      if (x < -20 || y < -20 || x > w + 20 || y > h + 20) continue;
      // Never in front of the black hole (the real sky there is lensed).
      const fade = smooth(bh.r * 1.15, bh.r * 1.55, Math.hypot(x - bh.cx, y - bh.cy));
      if (fade <= 0) continue;
      const behindCopy = quiet.some((b) => x > b.x - 24 && x < b.x + b.w + 24 && y > b.y - 24 && y < b.y + b.h + 24);
      const scint = s.scint && !rm ? 0.86 + 0.14 * Math.sin(now / 1000 * 2.3 + i * 1.7) : 1;
      const a = s.mag * fade * scint * (behindCopy ? 0.3 : 1);
      const [r, g, b] = TEMP[s.temp];
      if (quality < 2) {
        const halo = ctx.createRadialGradient(x, y, 0, x, y, 14 + 6 * s.mag);
        halo.addColorStop(0, `rgba(${r},${g},${b},${0.22 * a})`);
        halo.addColorStop(1, `rgba(${r},${g},${b},0)`);
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(x, y, 14 + 6 * s.mag, 0, Math.PI * 2);
        ctx.fill();
        if (s.mag > 0.8) {
          // Faint diffraction spikes on the brightest two only.
          ctx.strokeStyle = `rgba(${r},${g},${b},${0.16 * a})`;
          ctx.lineWidth = 0.6;
          ctx.beginPath();
          ctx.moveTo(x - 18, y);
          ctx.lineTo(x + 18, y);
          ctx.moveTo(x, y - 18);
          ctx.lineTo(x, y + 18);
          ctx.stroke();
        }
      }
      ctx.fillStyle = `rgba(${r},${g},${b},${Math.min(1, 0.95 * a + 0.05)})`;
      ctx.beginPath();
      ctx.arc(x, y, 1.1 + 0.7 * s.mag, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawMotes(dt: number, v: View, bh: Circle, quiet: Box[], zoomRate: number): void {
    if (options.reducedMotion()) return; // foreground motion is the first thing reduced motion removes
    for (const m of motes) {
      const speed = 0.4 + 1.6 * m.z;
      m.x += VESSEL_DRIFT[0] * speed * dt;
      m.y += VESSEL_DRIFT[1] * speed * dt;
      // Approach: dust streams outward from the centre as the camera moves in.
      if (zoomRate !== 0) {
        m.x += (m.x - w / 2) * zoomRate * dt * (0.6 + m.z);
        m.y += (m.y - h / 2) * zoomRate * dt * (0.6 + m.z);
      }
      if (m.x < -30) m.x += w + 60;
      if (m.x > w + 30) m.x -= w + 60;
      if (m.y < -30) m.y += h + 60;
      if (m.y > h + 30) m.y -= h + 60;
      const x = m.x + pointer.sx * (6 + 22 * m.z);
      const y = m.y + pointer.sy * (6 + 22 * m.z);
      const nearHole = smooth(bh.r * 1.05, bh.r * 1.7, Math.hypot(x - bh.cx, y - bh.cy));
      const behindCopy = quiet.some((b) => x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h) ? 0.4 : 1;
      const a = (0.07 + 0.17 * m.z) * nearHole * behindCopy * shownLevel;
      if (a < 0.004) continue;
      const r = 0.8 + 2.8 * m.z;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r * 2.2);
      g.addColorStop(0, `rgba(236,232,223,${a})`);
      g.addColorStop(1, "rgba(236,232,223,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r * 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  const rimSpots: { x: number; y: number; i: number }[] = [];

  function drawEncounters(now: number, v: View, bh: Circle): void {
    rimSpots.length = 0;
    for (let k = encounters.length - 1; k >= 0; k--) {
      const e = encounters[k]!;
      const t = (now - e.start) / e.duration;
      if (t >= 1) {
        encounters.splice(k, 1);
        continue;
      }
      const x = e.from[0] + (e.to[0] - e.from[0]) * t + pointer.sx * (e.kind === "probe" ? 4 : 18);
      const y = e.from[1] + (e.to[1] - e.from[1]) * t + pointer.sy * (e.kind === "probe" ? 4 : 18);
      const edgeFade = smooth(0, 0.08, t) * smooth(1, 0.92, t);
      // Light comes from the disk: the side of the object facing the black hole is rim-lit.
      const lx = bh.cx - x;
      const ly = bh.cy - y;
      const ll = Math.hypot(lx, ly) || 1;
      if (e.kind === "debris") {
        const ang = (now - e.start) / 1000 * e.spin;
        const s = e.size;
        for (const ghost of [0.06, 0.03, 0]) {
          const gx = x - (e.to[0] - e.from[0]) * ghost * 0.02;
          const gy = y - (e.to[1] - e.from[1]) * ghost * 0.02;
          ctx.save();
          ctx.translate(gx, gy);
          ctx.rotate(ang);
          ctx.beginPath();
          e.shape.forEach(([px, py], i) => (i ? ctx.lineTo(px * s, py * s) : ctx.moveTo(px * s, py * s)));
          ctx.closePath();
          const [ux, uy] = rot(lx / ll, ly / ll, -ang);
          const grad = ctx.createLinearGradient(ux * s, uy * s, -ux * s, -uy * s);
          grad.addColorStop(0, `rgba(243,235,211,${(ghost ? 0.12 : 0.62) * edgeFade})`);
          grad.addColorStop(0.35, `rgba(40,38,36,${(ghost ? 0.15 : 0.9) * edgeFade})`);
          grad.addColorStop(1, `rgba(8,9,12,${(ghost ? 0.15 : 0.95) * edgeFade})`);
          ctx.fillStyle = grad;
          ctx.fill();
          ctx.restore();
        }
        if (!e.cued && t > 0.5) {
          e.cued = true;
          options.onFlyby("debris", (x / w) * 2 - 1, Math.min(1, e.size / 16));
        }
        rimSpots.push({ x, y, i: 0.35 * edgeFade });
      } else {
        // Relay probe: body, two panel wings, a dish; a slow nav blink; one solar-panel glint.
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(-0.25 + t * 0.3);
        ctx.fillStyle = `rgba(18,19,24,${edgeFade})`;
        ctx.strokeStyle = `rgba(154,158,166,${0.7 * edgeFade})`;
        ctx.lineWidth = 0.6;
        ctx.fillRect(-2.5, -1.6, 5, 3.2);
        ctx.strokeRect(-2.5, -1.6, 5, 3.2);
        for (const sgn of [-1, 1]) {
          ctx.fillRect(sgn * 3.5 - (sgn < 0 ? 9 : 0), -1.1, 9, 2.2);
          ctx.strokeRect(sgn * 3.5 - (sgn < 0 ? 9 : 0), -1.1, 9, 2.2);
        }
        ctx.beginPath();
        ctx.arc(0, -3.2, 1.4, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
        const blink = ((now - e.start) % 2200) < 90;
        if (blink) {
          ctx.fillStyle = `rgba(255,122,96,${0.9 * edgeFade})`;
          ctx.beginPath();
          ctx.arc(x + 3, y + 2, 1.1, 0, Math.PI * 2);
          ctx.fill();
        }
        const glint = Math.exp(-((t - 0.45) ** 2) / (2 * 0.012 ** 2));
        if (glint > 0.01) {
          const gr = ctx.createRadialGradient(x, y, 0, x, y, 16);
          gr.addColorStop(0, `rgba(243,235,211,${0.85 * glint})`);
          gr.addColorStop(1, "rgba(243,235,211,0)");
          ctx.fillStyle = gr;
          ctx.beginPath();
          ctx.arc(x, y, 16, 0, Math.PI * 2);
          ctx.fill();
          rimSpots.push({ x, y, i: 0.9 * glint });
        }
        if (!e.cued && t > 0.45) {
          e.cued = true;
          options.onFlyby("probe", (x / w) * 2 - 1, 0.6);
        }
        // A brief caption as it enters: it's a fictional vessel, named in the mission's voice.
        const label = smooth(0.02, 0.06, t) * smooth(0.2, 0.15, t);
        if (label > 0.01) {
          ctx.font = "500 10px 'IBM Plex Mono', ui-monospace, monospace";
          ctx.fillStyle = `rgba(154,158,166,${0.85 * label})`;
          ctx.fillText("HZN-R2 · RELAY PROBE", x + 14, y + 14);
        }
      }
    }
  }

  function drawRim(v: View, bh: Circle): void {
    rctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    rctx.clearRect(0, 0, w, h);
    const win = options.window();
    if (win.w < 10) return;
    const { x, y, w: ww, h: wh, radius } = win;
    // Walk the rounded-rect rim; warm it where it faces the disk, brighten where objects pass.
    const pts: [number, number][] = [];
    const step = 6;
    const straight = (x0: number, y0: number, x1: number, y1: number) => {
      const n = Math.max(1, Math.floor(Math.hypot(x1 - x0, y1 - y0) / step));
      for (let i = 0; i < n; i++) pts.push([x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n]);
    };
    const corner = (cx: number, cy: number, a0: number) => {
      for (let i = 0; i < 8; i++) {
        const a = a0 + (i / 8) * (Math.PI / 2);
        pts.push([cx + Math.cos(a) * radius, cy + Math.sin(a) * radius]);
      }
    };
    straight(x + radius, y, x + ww - radius, y);
    corner(x + ww - radius, y + radius, -Math.PI / 2);
    straight(x + ww, y + radius, x + ww, y + wh - radius);
    corner(x + ww - radius, y + wh - radius, 0);
    straight(x + ww - radius, y + wh, x + radius, y + wh);
    corner(x + radius, y + wh - radius, Math.PI / 2);
    straight(x, y + wh - radius, x, y + radius);
    corner(x + radius, y + radius, Math.PI);
    const mx = x + ww / 2;
    const my = y + wh / 2;
    const toHole = Math.atan2(bh.cy - my, bh.cx - mx);
    // The disk's bright, approaching side is on the left of the shadow; bias the warm light that way.
    const warmDir = Math.atan2(Math.sin(toHole) * 0.4, -1);
    rctx.lineWidth = 1.5;
    rctx.lineCap = "round";
    for (let i = 0; i < pts.length; i++) {
      const [px, py] = pts[i]!;
      const [qx, qy] = pts[(i + 1) % pts.length]!;
      const ang = Math.atan2(py - my, px - mx);
      const warm = Math.max(0, Math.cos(ang - warmDir)) ** 3 * 0.22;
      let spot = 0;
      for (const s of rimSpots) spot += s.i * Math.exp(-((px - s.x) ** 2 + (py - s.y) ** 2) / (2 * 110 * 110));
      const a = Math.min(0.75, warm + spot);
      if (a < 0.01) continue;
      rctx.strokeStyle = `rgba(243,235,211,${a})`;
      rctx.beginPath();
      rctx.moveTo(px, py);
      rctx.lineTo(qx, qy);
      rctx.stroke();
    }
  }

  // ----------------------------------------------------------------- loop

  function frame(now: number): void {
    raf = 0;
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    if (now - last > 0) {
      frameTimes.push(now - last);
      if (frameTimes.length >= 90) {
        const sorted = [...frameTimes].sort((a, b) => a - b);
        frameTimes.length = 0;
        if (sorted[45]! > 22 && quality < 2) {
          quality += 1; // adaptive quality: fewer motes, then no halos/dust
          seedMotes();
        }
      }
    }
    last = now;
    const rm = options.reducedMotion();
    const k = 1 - Math.exp(-dt / 0.5);
    pointer.sx += ((rm ? 0 : pointer.x) - pointer.sx) * k;
    pointer.sy += ((rm ? 0 : pointer.y) - pointer.sy) * k;
    shownLevel += (level - shownLevel) * (1 - Math.exp(-dt / 0.35));
    const v = options.view();
    const zoomRate = lastFov === undefined || rm ? 0 : (v.fov - lastFov) / Math.max(dt, 1e-3) / v.fov;
    lastFov = v.fov;
    const bh = options.blackHole(v, w, h);
    const quiet = options.quiet();

    if (!rm && level > 0.9) {
      if (now > nextDebris) {
        nextDebris = now + (spawn("debris", now) ? 35000 + random() * 35000 : 10000);
      }
      if (now > nextProbe) {
        nextProbe = now + (spawn("probe", now) ? 180000 + random() * 60000 : 15000);
      }
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    drawHeroes(v, now, quiet, bh);
    drawMotes(dt, v, bh, quiet, zoomRate);
    if (!rm) drawEncounters(now, v, bh);
    else encounters.length = 0;
    drawRim(v, bh);
    if (!document.hidden && !paused) raf = requestAnimationFrame(frame);
  }

  function shiftClocks(by: number): void {
    for (const e of encounters) e.start += by;
    nextDebris += by;
    nextProbe += by;
  }

  const onVisibility = () => {
    if (document.hidden) {
      cancelAnimationFrame(raf);
      raf = 0;
    } else if (!raf && !paused) {
      // Shift schedules so a hidden tab doesn't come back to a burst of encounters.
      const t = performance.now();
      nextDebris = Math.max(nextDebris, t + 8000);
      nextProbe = Math.max(nextProbe, t + 30000);
      last = t;
      raf = requestAnimationFrame(frame);
    }
  };

  resize();
  window.addEventListener("resize", resize, { passive: true });
  document.addEventListener("visibilitychange", onVisibility);
  raf = requestAnimationFrame(frame);

  return {
    get quality() {
      return quality;
    },
    setLevel(next) {
      level = Math.min(1, Math.max(0, next));
    },
    setPaused(next) {
      if (next === paused) return;
      paused = next;
      if (paused) {
        pausedAt = performance.now();
        cancelAnimationFrame(raf);
        // Draw one settled frame, then stop: paused (and reduced-motion) visitors keep a full static sky.
        raf = requestAnimationFrame(frame);
      } else {
        const t = performance.now();
        shiftClocks(t - pausedAt);
        last = t;
        if (!document.hidden && !raf) raf = requestAnimationFrame(frame);
      }
    },
    setPointer(nx, ny) {
      pointer.x = nx;
      pointer.y = ny;
    },
    spawn(kind) {
      return spawn(kind);
    },
    positions() {
      const t = performance.now();
      return encounters.map((e) => {
        const k = Math.min(1, (t - e.start) / e.duration);
        return { kind: e.kind, x: e.from[0] + (e.to[0] - e.from[0]) * k, y: e.from[1] + (e.to[1] - e.from[1]) * k, size: e.size };
      });
    },
    dispose() {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVisibility);
    },
  };
}
