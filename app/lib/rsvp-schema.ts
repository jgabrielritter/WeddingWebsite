export type AttendingColumn = "attending" | "Yes/No" | string;

export type RsvpSchemaConfig = {
  table: string;
  attendingColumn: AttendingColumn;
  emailColumn: string | null;
};

export function getRsvpSchemaConfig(): RsvpSchemaConfig {
  const emailColumn = process.env.RSVP_EMAIL_COLUMN;
  return {
    table: process.env.RSVP_TABLE ?? "RSVP",
    attendingColumn: process.env.RSVP_ATTENDING_COLUMN ?? "attending",
    emailColumn: emailColumn === "" ? null : emailColumn ?? "email",
  };
}

export function buildAttendingPayload(attending: boolean, column: AttendingColumn) {
  if (column === "attending") {
    return { attending };
  }

  return { [column]: attending ? "Yes" : "No" };
}

export function normalizeAttendingValue(value: unknown): boolean | null {
  if (typeof value === "boolean") {
    return value;
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

export function getAttendingSelectColumn(column: AttendingColumn): string {
  return column === "attending" ? "attending" : `"${column}"`;
}
