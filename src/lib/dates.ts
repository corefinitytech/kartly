// Drizzle's postgres-js driver turns off the client's timestamp parsing, so
// raw `db.execute` rows carry timestamps as Postgres text, e.g.
// "2026-09-30 07:31:15.123456+00". Typed Drizzle queries still map to Date.
// Always go through toIso() for raw rows; calling .toISOString() on them throws.
export type DbTimestamp = Date | string;

export function toDate(value: DbTimestamp): Date {
  if (value instanceof Date) return value;
  const iso = value
    .trim()
    .replace(" ", "T") // date/time separator
    .replace(/(\.\d{3})\d+/, "$1") // microseconds -> milliseconds
    .replace(/([+-]\d{2})$/, "$1:00"); // "+00" -> "+00:00"
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) throw new Error("Unrecognised timestamp");
  return date;
}

export function toIso(value: DbTimestamp): string {
  return toDate(value).toISOString();
}

export function toIsoOrNull(value: DbTimestamp | null | undefined): string | null {
  return value == null ? null : toIso(value);
}
