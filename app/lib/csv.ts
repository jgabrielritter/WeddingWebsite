export function escapeCsvValue(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) {
    return "";
  }

  const stringValue = String(value);
  if (/[",\n\r]/.test(stringValue)) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }

  return stringValue;
}

export function rowsToCsv<T>(rows: T[], headers: (keyof T)[], headerLabels: string[]): string {
  const headerLine = headerLabels.map((label) => escapeCsvValue(label)).join(",");
  const bodyLines = rows.map((row) => {
    return headers.map((key) => escapeCsvValue(row[key])).join(",");
  });

  return [headerLine, ...bodyLines].join("\n");
}
