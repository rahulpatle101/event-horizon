// Points from shapes: rasterise a shape onto a hidden 2D canvas, then sample its filled
// pixels into `count` evenly spread points. One function serves the patch (SVG) and,
// in task 5, the typed name (text).

export type Draw2D = (ctx: CanvasRenderingContext2D, size: number) => void;

/** Deterministic PRNG so the same shape always yields the same point cloud. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Sample `count` points from the filled area drawn by `draw` on a square canvas of `size` px.
 * Returns points in that canvas's pixel space (0..size). Uses jittered cells so points cover
 * thin strokes evenly instead of clumping.
 */
export function samplePoints(draw: Draw2D, count: number, size = 400, seed = 7): Float32Array {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("2D canvas unavailable");
  draw(ctx, size);
  const { data } = ctx.getImageData(0, 0, size, size);

  const filled: number[] = [];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (data[(y * size + x) * 4 + 3]! > 127) filled.push(x, y);
    }
  }
  const out = new Float32Array(count * 2);
  const pixels = filled.length / 2;
  if (pixels === 0) return out;
  const random = mulberry32(seed);
  // Stratified pick: walk the filled pixels in order with a random offset per stride,
  // so every part of the shape gets its share of points.
  const stride = pixels / count;
  for (let i = 0; i < count; i++) {
    const index = Math.min(pixels - 1, Math.floor((i + random()) * stride));
    out[i * 2] = filled[index * 2]! + random();
    out[i * 2 + 1] = filled[index * 2 + 1]! + random();
  }
  // Shuffle so consumers can take any prefix and still get the whole shape.
  for (let i = count - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    const ax = out[i * 2]!, ay = out[i * 2 + 1]!;
    out[i * 2] = out[j * 2]!;
    out[i * 2 + 1] = out[j * 2 + 1]!;
    out[j * 2] = ax;
    out[j * 2 + 1] = ay;
  }
  return out;
}

/**
 * Build a Draw2D from an SVG string. Shapes are drawn through an <img>; <text> elements are
 * removed from the image and redrawn with canvas text so they use the page's loaded web font.
 */
export async function drawFromSvg(svgSource: string, fontFamily: string): Promise<Draw2D> {
  const doc = new DOMParser().parseFromString(svgSource, "image/svg+xml");
  const svg = doc.documentElement;
  const [vx, vy, vw, vh] = (svg.getAttribute("viewBox") ?? "0 0 100 100").split(/[\s,]+/).map(Number) as [
    number, number, number, number,
  ];
  const texts = [...svg.querySelectorAll("text")].map((t) => {
    const info = {
      text: t.textContent ?? "",
      x: Number(t.getAttribute("x") ?? 0),
      y: Number(t.getAttribute("y") ?? 0),
      size: Number(t.getAttribute("font-size") ?? 16),
      weight: t.getAttribute("font-weight") ?? "400",
      spacing: Number(t.getAttribute("letter-spacing") ?? 0),
      anchor: t.getAttribute("text-anchor") ?? "start",
    };
    t.remove();
    return info;
  });
  const blob = new Blob([new XMLSerializer().serializeToString(svg)], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  const image = new Image();
  image.decoding = "async";
  image.src = url;
  try {
    await image.decode();
  } finally {
    URL.revokeObjectURL(url);
  }
  await Promise.all(texts.map((t) => document.fonts.load(`${t.weight} ${t.size}px ${fontFamily}`)));

  return (ctx, size) => {
    const scale = size / Math.max(vw, vh);
    ctx.drawImage(image, 0, 0, vw * scale, vh * scale);
    ctx.save();
    ctx.scale(scale, scale);
    ctx.translate(-vx, -vy);
    ctx.fillStyle = "#fff";
    for (const t of texts) {
      ctx.font = `${t.weight} ${t.size}px ${fontFamily}`;
      ctx.letterSpacing = `${t.spacing}px`;
      ctx.textAlign = t.anchor === "middle" ? "center" : t.anchor === "end" ? "right" : "left";
      // Letter spacing adds trailing space after the last glyph; shift back half of it when centred.
      const shift = t.anchor === "middle" ? t.spacing / 2 : 0;
      ctx.fillText(t.text, t.x + shift, t.y);
    }
    ctx.restore();
  };
}
