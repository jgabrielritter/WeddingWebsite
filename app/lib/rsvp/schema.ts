export const RSVP_TABLE = "RSVP";
export const NAME_COL = "Name";
export const ATTENDING_COL = "attending";
export const LEGACY_YESNO_COL = "Yes/No";
export const EMAIL_COL = "email";

export type AttendingWriteMode = "attending" | "legacy";

export type RsvpSchemaConfig = {
  table: string;
  nameColumn: string;
  attendingColumn: string;
  legacyYesNoColumn: string;
  emailColumn: string | null;
  writeMode: AttendingWriteMode;
};

export type RsvpInsertPayload = {
  name: string;
  attending: boolean;
  email?: string | null;
};

export function getRsvpSchemaConfig(): RsvpSchemaConfig {
  const emailColumn = process.env.RSVP_EMAIL_COLUMN;
  const attendingColumn = process.env.RSVP_ATTENDING_COLUMN ?? ATTENDING_COL;
  const writeMode: AttendingWriteMode =
    attendingColumn === ATTENDING_COL ? "attending" : "legacy";

  return {
    table: process.env.RSVP_TABLE ?? RSVP_TABLE,
    nameColumn: NAME_COL,
    attendingColumn,
    legacyYesNoColumn: LEGACY_YESNO_COL,
    emailColumn: emailColumn === "" ? null : emailColumn ?? EMAIL_COL,
    writeMode,
  };
}

export function buildInsertPayload(
  { name, attending, email }: RsvpInsertPayload,
  mode: AttendingWriteMode,
  columns?: {
    nameColumn?: string;
    attendingColumn?: string;
    legacyYesNoColumn?: string;
    emailColumn?: string | null;
  }
): Record<string, string | boolean> {
  const nameColumn = columns?.nameColumn ?? NAME_COL;
  const attendingColumn = columns?.attendingColumn ?? ATTENDING_COL;
  const legacyYesNoColumn = columns?.legacyYesNoColumn ?? LEGACY_YESNO_COL;
  const emailColumn =
    columns?.emailColumn === undefined ? EMAIL_COL : columns?.emailColumn;

  const payload: Record<string, string | boolean> = {
    [nameColumn]: name,
  };

  if (email && emailColumn) {
    payload[emailColumn] = email;
  }

  if (mode === "attending") {
    payload[attendingColumn] = attending;
  } else {
    payload[legacyYesNoColumn] = attending ? "Yes" : "No";
  }

  return payload;
}

export function normalizeAttending(input: unknown): boolean | null {
  if (typeof input === "boolean") {
    return input;
  }

  if (typeof input === "string") {
    const normalized = input.trim().toLowerCase();
    if (["yes", "y", "true", "1"].includes(normalized)) {
      return true;
    }
    if (["no", "n", "false", "0"].includes(normalized)) {
      return false;
    }
  }

  return null;
}

export function getAttendingSelectColumn(column: string): string {
  return column === ATTENDING_COL ? ATTENDING_COL : `"${column}"`;
}
