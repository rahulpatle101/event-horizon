// Countdown to the fictional ARDENT launch window. Days are the hero; HH:MM:SS is secondary.
export const WINDOW_OPENS = Date.UTC(2028, 10, 20); // 20 Nov 2028, 00:00 UTC

export interface Remaining {
  days: number;
  clock: string;
  open: boolean;
}

const pad = (n: number) => String(n).padStart(2, "0");

export function remaining(now = Date.now()): Remaining {
  const ms = Math.max(0, WINDOW_OPENS - now);
  const total = Math.floor(ms / 1000);
  const days = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return { days, clock: `${pad(h)}:${pad(m)}:${pad(s)}`, open: ms === 0 };
}
