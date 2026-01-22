export type RsvpCloseInfo = {
  closeAt: Date | null;
  closed: boolean;
};

export function parseAttending(value: unknown): boolean | null {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    if (value === 1) return true;
    if (value === 0) return false;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["yes", "y", "true", "1"].includes(normalized)) {
      return true;
    }
    if (["no", "n", "false", "0"].includes(normalized)) {
      return false;
    }
  }

  return null;
}

export function getRsvpCloseInfo(closeAtIso?: string | null, now = new Date()): RsvpCloseInfo {
  if (!closeAtIso) {
    return { closeAt: null, closed: false };
  }

  const parsed = new Date(closeAtIso);
  if (Number.isNaN(parsed.getTime())) {
    return { closeAt: null, closed: false };
  }

  return { closeAt: parsed, closed: now.getTime() > parsed.getTime() };
}

export function formatDisplayDate(date: Date, timeZone?: string): string {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  }).format(date);
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
