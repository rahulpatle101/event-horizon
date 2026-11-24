// Observation-deck sound: synthesised live with WebAudio (no audio files, nothing borrowed).
// Warm, exploratory, technological. Nothing plays until the visitor presses "Enable sound";
// the context suspends when the tab is hidden. Every cue mirrors a visible event.

export type Cue = "approach" | "settle" | "scanStart" | "reveal" | "scanDone" | "record" | "return";

export interface DeckAudio {
  readonly available: boolean;
  readonly enabled: boolean;
  /** Must be called from a user gesture. Starts the ambient bed. */
  enable(): Promise<boolean>;
  setMuted(muted: boolean): void;
  setVolume(volume: number): void; // 0..1
  cue(name: Cue, detail?: { index?: number }): void;
  /** A passing object: pan −1..1 at closest approach, intensity 0..1. */
  flyby(kind: "debris" | "probe", pan: number, intensity: number): void;
  /** Duck the ambience (0..1) while signature moments play. */
  duck(amount: number): void;
  context(): AudioContext | undefined;
  /** Test/inspection tap on the final output (post-limiter). */
  meter(): AnalyserNode | undefined;
}

const A3 = 220;
const E4 = 329.63;
const CS5 = 554.37;

export function createDeckAudio(): DeckAudio {
  const Ctor: typeof AudioContext | undefined =
    typeof window !== "undefined" ? window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext : undefined;
  let ctx: AudioContext | undefined;
  let master: GainNode | undefined; // volume × mute
  let ambience: GainNode | undefined; // ducking target
  let fx: GainNode | undefined;
  let enabled = false;
  let muted = false;
  let volume = 0.7;
  const lastCueAt = new Map<string, number>();
  let analyser: AnalyserNode | undefined;
  let limiterNode: DynamicsCompressorNode | undefined;

  const now = () => ctx?.currentTime ?? 0;

  function applyMaster(): void {
    if (!ctx || !master) return;
    const target = muted ? 0 : volume * volume; // perceptual curve
    const t = now();
    master.gain.cancelScheduledValues(t);
    master.gain.setValueAtTime(master.gain.value, t);
    master.gain.linearRampToValueAtTime(target, t + 0.12); // reaches true zero when muted
  }

  function noiseBuffer(c: AudioContext, seconds: number, brown: boolean): AudioBuffer {
    const buf = c.createBuffer(1, Math.floor(c.sampleRate * seconds), c.sampleRate);
    const data = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i++) {
      const white = Math.random() * 2 - 1;
      if (brown) {
        last = (last + 0.02 * white) / 1.02;
        data[i] = last * 3.5;
      } else data[i] = white;
    }
    return buf;
  }

  /** Cabin bed: brown-noise hush, a slow detuned pad on A1/E2 with a breathing filter, a faint high shimmer. */
  function startAmbience(c: AudioContext, out: AudioNode): void {
    const hush = c.createBufferSource();
    hush.buffer = noiseBuffer(c, 6, true);
    hush.loop = true;
    const hushLp = c.createBiquadFilter();
    hushLp.type = "lowpass";
    hushLp.frequency.value = 220;
    const hushGain = c.createGain();
    hushGain.gain.value = 0.022; // the bed sits well under the cues (~ -40 dBFS at default volume)
    hush.connect(hushLp).connect(hushGain).connect(out);
    hush.start();

    const padFilter = c.createBiquadFilter();
    padFilter.type = "lowpass";
    padFilter.frequency.value = 420;
    padFilter.Q.value = 0.7;
    const padGain = c.createGain();
    padGain.gain.value = 0.018;
    padFilter.connect(padGain).connect(out);
    for (const [f, detune, type] of [
      [55, -6, "sine"],
      [55, 7, "triangle"],
      [82.41, 4, "sine"],
      [110, -3, "sine"],
    ] as const) {
      const o = c.createOscillator();
      o.type = type;
      o.frequency.value = f;
      o.detune.value = detune;
      o.connect(padFilter);
      o.start();
    }
    // The filter breathes very slowly so the bed never sits still.
    const lfo = c.createOscillator();
    lfo.frequency.value = 0.031;
    const lfoDepth = c.createGain();
    lfoDepth.gain.value = 180;
    lfo.connect(lfoDepth).connect(padFilter.frequency);
    lfo.start();

    const shimmer = c.createOscillator();
    shimmer.frequency.value = 1760;
    const shimmerGain = c.createGain();
    shimmerGain.gain.value = 0;
    const shimmerLfo = c.createOscillator();
    shimmerLfo.frequency.value = 0.07;
    const shimmerDepth = c.createGain();
    shimmerDepth.gain.value = 0.002;
    shimmerLfo.connect(shimmerDepth).connect(shimmerGain.gain);
    shimmer.connect(shimmerGain).connect(out);
    shimmer.start();
    shimmerLfo.start();
  }

  /** A soft bell: sine partials with fast attack and exponential decay. */
  function bell(freqs: number[], at: number, decay: number, level: number, pan = 0): void {
    if (!ctx || !fx) return;
    const p = ctx.createStereoPanner();
    p.pan.value = pan;
    p.connect(fx);
    freqs.forEach((f, i) => {
      const o = ctx!.createOscillator();
      o.type = "sine";
      o.frequency.value = f;
      const g = ctx!.createGain();
      const peak = level / (1 + i * 0.6);
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(peak, at + 0.006);
      g.gain.exponentialRampToValueAtTime(0.0001, at + decay);
      o.connect(g).connect(p);
      o.start(at);
      o.stop(at + decay + 0.05);
    });
  }

  /** Filtered noise gesture (breath / whoosh / click). */
  function noise(at: number, dur: number, from: number, to: number, level: number, pan = 0, q = 0.9, type: BiquadFilterType = "bandpass"): void {
    if (!ctx || !fx) return;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(ctx, Math.max(0.05, dur + 0.05), false);
    const bp = ctx.createBiquadFilter();
    bp.type = type;
    bp.Q.value = q;
    bp.frequency.setValueAtTime(from, at);
    bp.frequency.exponentialRampToValueAtTime(to, at + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(level, at + dur * 0.45);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    const p = ctx.createStereoPanner();
    p.pan.setValueAtTime(-pan, at);
    p.pan.linearRampToValueAtTime(pan, at + dur);
    src.connect(bp).connect(g).connect(p).connect(fx);
    src.start(at);
    src.stop(at + dur + 0.05);
  }

  function tone(freq: number, to: number, at: number, dur: number, level: number, type: OscillatorType = "sine"): void {
    if (!ctx || !fx) return;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, at);
    o.frequency.exponentialRampToValueAtTime(to, at + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(level, at + Math.min(0.25, dur * 0.4));
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    o.connect(g).connect(fx);
    o.start(at);
    o.stop(at + dur + 0.05);
  }

  /** Repetition guard: the same cue never stacks within `ms`. */
  function allow(key: string, ms: number): boolean {
    const t = performance.now();
    if ((lastCueAt.get(key) ?? -Infinity) + ms > t) return false;
    lastCueAt.set(key, t);
    return true;
  }

  function onVisibility(): void {
    if (!ctx || !enabled) return;
    if (document.hidden) void ctx.suspend();
    else void ctx.resume();
  }

  return {
    get available() {
      return Boolean(Ctor);
    },
    get enabled() {
      return enabled;
    },
    async enable() {
      if (enabled) return true;
      if (!Ctor) return false;
      try {
        ctx = new Ctor({ latencyHint: "interactive" });
        const limiter = ctx.createDynamicsCompressor();
        limiter.threshold.value = -12;
        limiter.ratio.value = 6;
        master = ctx.createGain();
        master.gain.value = 0;
        ambience = ctx.createGain();
        ambience.gain.value = 1;
        fx = ctx.createGain();
        fx.gain.value = 1;
        ambience.connect(master);
        fx.connect(master);
        master.connect(limiter).connect(ctx.destination);
        limiterNode = limiter;
        startAmbience(ctx, ambience);
        await ctx.resume();
        enabled = true;
        applyMaster();
        document.addEventListener("visibilitychange", onVisibility);
        return true;
      } catch {
        enabled = false;
        return false;
      }
    },
    setMuted(next) {
      muted = next;
      applyMaster();
    },
    setVolume(next) {
      volume = Math.min(1, Math.max(0, next));
      applyMaster();
    },
    duck(amount) {
      if (!ctx || !ambience) return;
      ambience.gain.setTargetAtTime(1 - 0.6 * Math.min(1, Math.max(0, amount)), now(), 0.25);
    },
    context: () => ctx,
    meter() {
      if (!ctx || !limiterNode) return undefined;
      if (!analyser) {
        analyser = ctx.createAnalyser();
        analyser.fftSize = 2048;
        limiterNode.connect(analyser);
      }
      return analyser;
    },
    cue(name, detail) {
      if (!enabled || !ctx || ctx.state !== "running") return;
      const t = now() + 0.01;
      switch (name) {
        case "approach": // a low warm swell under the camera move
          if (!allow(name, 800)) return;
          tone(98, 147, t, 1.3, 0.12, "triangle");
          noise(t, 1.2, 180, 900, 0.06, 0);
          break;
        case "settle": // the instrument acknowledges: a soft two-partial bell
          if (!allow(name, 800)) return;
          bell([659.25, 987.77], t, 1.1, 0.2);
          break;
        case "return":
          if (!allow(name, 800)) return;
          tone(147, 98, t, 1.0, 0.1, "triangle");
          break;
        case "scanStart": // a faint rising sweep, the length of the wavefront
          if (!allow(name, 1500)) return;
          tone(220, 440, t, 1.6, 0.05, "sine");
          noise(t, 1.6, 2400, 600, 0.03, 0, 3);
          break;
        case "reveal": // one note per feature: A3, E4, C#5
          bell([[A3, E4, CS5][detail?.index ?? 0]!, ([A3, E4, CS5][detail?.index ?? 0]!) * 2], t, 0.9, 0.18);
          break;
        case "scanDone": // a soft A-major bloom
          if (!allow(name, 1500)) return;
          bell([A3, E4, CS5, 880], t + 0.05, 1.8, 0.18);
          break;
        case "record": // tactile latch: click + low thunk + rising confirmation
          if (!allow(name, 800)) return;
          noise(t, 0.03, 4200, 3000, 0.22, 0, 0.7, "highpass");
          tone(92, 60, t + 0.01, 0.16, 0.3, "sine");
          bell([659.25], t + 0.12, 0.5, 0.13);
          bell([880], t + 0.26, 0.9, 0.13);
          break;
      }
    },
    flyby(kind, pan, intensity) {
      if (!enabled || !ctx || ctx.state !== "running") return;
      const t = now() + 0.01;
      const p = Math.max(-1, Math.min(1, pan));
      if (kind === "debris") {
        if (!allow("debris", 4000)) return;
        noise(t, 1.6, 300, 1400, 0.07 * (0.4 + intensity), p, 1.4); // passing air-like whoosh, panned across
      } else {
        if (!allow("probe", 20000)) return;
        // a quiet telemetry chirp from the probe's side of the window
        bell([1318.5], t, 0.35, 0.06, p);
        bell([1760], t + 0.16, 0.45, 0.05, p);
      }
    },
  };
}
