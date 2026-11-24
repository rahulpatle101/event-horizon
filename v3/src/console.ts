// Console frame (ART_DIRECTION §7.1): one L-shaped elbow in the bottom-left corner. A vertical bar meets a
// horizontal bar with outer radius = bar width / 2 and a smaller inner radius; bars split into segments
// with 4px void gaps (rhythm long, short, short, long) and end in half-pill caps. Labels are dark mono text
// inside the segments, right-aligned. One horizontal segment is the HOLD track (fills in the motion pass).
// Drawn in real pixels on resize so radii and gaps stay exact.

const NS = "http://www.w3.org/2000/svg";
const GAP = 4;

type Fill = "apricot" | "periwink" | "track";

export interface ConsoleFrame {
  /** 0..1 fill of the hold segment. */
  setHold(fraction: number): void;
  setOnline(online: boolean): void;
  layout(): void;
}

function node<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>, parent: Element) {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, String(v));
  parent.append(n);
  return n;
}

export function buildConsoleFrame(svg: SVGSVGElement, mobile: () => boolean): ConsoleFrame {
  let holdTrack: { x: number; y: number; w: number; h: number } | undefined;
  let holdFill: SVGRectElement | undefined;
  let holdSegment: SVGPathElement | undefined;
  let holdLabel: SVGTextElement | undefined;
  let hold = 0;
  let online = false;

  function label(text: string, x: number, y: number, parent: Element, anchor = "end") {
    const t = node("text", { x, y, "text-anchor": anchor, "dominant-baseline": "middle", class: "frame__label" }, parent);
    t.textContent = text;
    return t;
  }

  function layout(): void {
    const w = svg.clientWidth;
    const h = svg.clientHeight;
    if (w < 10 || h < 10) return;
    svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
    svg.replaceChildren();
    const small = mobile();
    const V = small ? 56 : 104; // vertical bar width
    const H = small ? 24 : 28; // horizontal bar height
    const Ro = V / 2; // outer radius
    const Ri = small ? 14 : 20; // inner radius
    const elbowH = Ro + H + Ri + 24; // vertical extent of the elbow piece

    // Each segment gets a boot index so the wipe staggers left→right, top→bottom (40 ms apart).
    let bootIndex = 0;
    const seg = (d: string, fill: Fill) =>
      node("path", { d, class: `frame__seg frame__seg--${fill}`, style: `--i:${bootIndex++}` }, svg);

    // Vertical bar, top → elbow: a capped top segment, then a long segment.
    const topH = small ? 40 : 72;
    const yElbow = h - elbowH;
    if (yElbow - topH - GAP > 24) {
      seg(`M 0 ${V / 2} A ${V / 2} ${V / 2} 0 0 1 ${V} ${V / 2} V ${topH} H 0 Z`, "periwink");
      label("26-4", V - 10, topH - 14, svg);
      seg(`M 0 ${topH + GAP} H ${V} V ${yElbow - GAP} H 0 Z`, "apricot");
      label("04-11", V - 10, yElbow - GAP - 14, svg);
    }

    // Elbow: vertical piece turning into the horizontal bar.
    const xElbowEnd = V + Ri + (small ? 40 : 96);
    seg(
      [
        `M 0 ${yElbow}`,
        `H ${V}`,
        `V ${h - H - Ri}`,
        `A ${Ri} ${Ri} 0 0 0 ${V + Ri} ${h - H}`,
        `H ${xElbowEnd}`,
        `V ${h}`,
        `H ${Ro}`,
        `A ${Ro} ${Ro} 0 0 1 0 ${h - Ro}`,
        "Z",
      ].join(" "),
      "apricot",
    );
    label("WREN", xElbowEnd - 10, h - H / 2, svg);

    // Horizontal segments: long, short, short (hold), long with a half-pill cap.
    let x = xElbowEnd + GAP;
    const remaining = w - x;
    const unit = (remaining - GAP * 3) / (small ? 7 : 9);
    const lens = small ? [2, 1, 2.5, 1.5] : [3, 1, 2.5, 2.5];
    const fills: Fill[] = ["periwink", "apricot", "track", "apricot"];
    // Phones get short codes so every label fits its segment.
    const labels = small ? ["12", "07", "HOLD", "04"] : ["12 · POWER", "07", "HOLD", "PORT 04"];
    lens.forEach((len, i) => {
      const segW = unit * len;
      const last = i === lens.length - 1;
      const y0 = h - H;
      const d = last
        ? `M ${x} ${y0} H ${x + segW - H / 2} A ${H / 2} ${H / 2} 0 0 1 ${x + segW - H / 2} ${h} H ${x} Z`
        : `M ${x} ${y0} H ${x + segW} V ${h} H ${x} Z`;
      const path = seg(d, fills[i]!);
      if (i === 1) path.classList.add("frame__seg--pulse"); // breathes with STANDBY
      if (fills[i] === "track") {
        holdSegment = path;
        holdTrack = { x, y: y0, w: segW, h: H };
        holdFill = node("rect", { x, y: y0, width: 0, height: H, class: "frame__hold" }, svg);
      }
      const t = label(labels[i]!, x + segW - (last ? H / 2 + 6 : 8), h - H / 2, svg);
      if (fills[i] === "track") holdLabel = t;
      x += segW + GAP;
    });
    apply();
  }

  function apply(): void {
    if (!holdTrack || !holdFill || !holdSegment) return;
    holdFill.setAttribute("width", String((holdTrack.w * hold).toFixed(1)));
    holdSegment.classList.toggle("frame__seg--online", online);
    holdFill.classList.toggle("is-hidden", online);
    // The label sits at the right end of the track: light on the empty track, dark once fill or online covers it.
    holdLabel?.classList.toggle("frame__label--on-track", !online && hold < 0.85);
  }

  layout();
  return {
    layout,
    setHold(fraction) {
      hold = Math.min(1, Math.max(0, fraction));
      apply();
    },
    setOnline(next) {
      online = next;
      apply();
    },
  };
}
