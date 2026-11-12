import { asc, desc, sql, type SQL, type SQLWrapper } from "drizzle-orm";

export const PAGE_SIZE = 20;
export interface Cursor { at: string; id: string; direction: "older" | "newer" }

/** Keep PostgreSQL's microsecond precision: JS Date truncation can skip rows at a page boundary. */
export function cursorTimestamp(column: SQLWrapper): SQL<string> {
  return sql<string>`to_char(${column} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`;
}

export function decodeCursor(value: string | undefined): Cursor | null {
  if (typeof value !== "string" || !value || value.length > 512 || !/^[A-Za-z0-9_-]+$/.test(value)) return null;
  try {
    const input: unknown = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    if (!input || typeof input !== "object") return null;
    const { at, id, direction } = input as Record<string, unknown>;
    if (typeof at !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/.test(at) || at.startsWith("0000")) return null;
    const parsed = new Date(at);
    if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 19) !== at.slice(0, 19)) return null;
    if (typeof id !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(id)) return null;
    if (direction !== "older" && direction !== "newer") return null;
    return { at, id, direction };
  } catch { return null; }
}

export function encodeCursor(cursor: Cursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString("base64url");
}

export function cursorCondition(time: SQLWrapper, id: SQLWrapper, cursor: Cursor | null): SQL | undefined {
  if (!cursor) return undefined;
  return cursor.direction === "older"
    ? sql`(${time}, ${id}) < (${cursor.at}::timestamptz, ${cursor.id})`
    : sql`(${time}, ${id}) > (${cursor.at}::timestamptz, ${cursor.id})`;
}

export function cursorOrder(time: SQLWrapper, id: SQLWrapper, cursor: Cursor | null): [SQL, SQL] {
  return cursor?.direction === "newer" ? [asc(time), asc(id)] : [desc(time), desc(id)];
}

export function cursorPage<T extends { id: string; cursorAt: string }>(rows: T[], cursor: Cursor | null) {
  const extra = rows.length > PAGE_SIZE;
  const items = rows.slice(0, PAGE_SIZE);
  if (cursor?.direction === "newer") items.reverse();
  const first = items[0], last = items[items.length - 1];
  const previous = first && (cursor?.direction === "older" || (cursor?.direction === "newer" && extra))
    ? encodeCursor({ at: first.cursorAt, id: first.id, direction: "newer" }) : null;
  const next = last && (cursor?.direction === "newer" || extra)
    ? encodeCursor({ at: last.cursorAt, id: last.id, direction: "older" }) : null;
  return { items, previous, next };
}
