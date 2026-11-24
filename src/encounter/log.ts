// Expedition log kept in this browser only. Falls back to memory when storage is unavailable,
// and reports which one happened so the UI can say whether an entry persists.

export interface Finding {
  title: string;
  text: string;
}

export interface LogEntry {
  id: number;
  name: string;
  recordedAt: string; // ISO timestamp
  findings: Finding[];
  geometry: { label: string; value: string }[];
  /** Captured encounter plate (small JPEG data URL), when one could be taken. */
  thumb?: string;
}

const KEY = "event-horizon.expedition-log.v1";
let memory: LogEntry[] = [];
let memoryOnly = false; // set once a write fails; memory then holds the full log

function storage(): Storage | undefined {
  try {
    const s = window.localStorage;
    const probe = `${KEY}.probe`;
    s.setItem(probe, "1");
    s.removeItem(probe);
    return s;
  } catch {
    return undefined;
  }
}

function isEntry(value: unknown): value is LogEntry {
  const v = value as LogEntry;
  return (
    typeof v === "object" && v !== null && typeof v.id === "number" && typeof v.name === "string" &&
    typeof v.recordedAt === "string" && Array.isArray(v.findings) && Array.isArray(v.geometry)
  );
}

export function readLog(): LogEntry[] {
  const s = memoryOnly ? undefined : storage();
  if (!s) return memory;
  try {
    const parsed: unknown = JSON.parse(s.getItem(KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter(isEntry) : [];
  } catch {
    return [];
  }
}

export function appendEntry(
  entry: Omit<LogEntry, "id" | "name" | "recordedAt">
): { entry: LogEntry; persisted: boolean } {
  const entries = readLog();
  const id = (entries.at(-1)?.id ?? 0) + 1;
  const full: LogEntry = {
    ...entry,
    id,
    name: `Encounter ${String(id).padStart(3, "0")} · Black hole`,
    recordedAt: new Date().toISOString(),
  };
  // Plates are kept for the latest 10 entries only, so the log stays well inside storage quotas.
  const next = [...entries, full].map((e, i, all) => (i < all.length - 10 ? { ...e, thumb: undefined } : e));
  const s = storage();
  if (s) {
    try {
      s.setItem(KEY, JSON.stringify(next));
      return { entry: full, persisted: true };
    } catch {
      // Quota or privacy mode: keep it for this page only.
    }
  }
  memory = next;
  memoryOnly = true;
  return { entry: full, persisted: false };
}

export function storageAvailable(): boolean {
  return storage() !== undefined;
}
