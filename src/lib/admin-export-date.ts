export type WibDateResult = { valid: true; date?: Date } | { valid: false };

/** Parse an optional YYYY-MM-DD filter as WIB without silently normalizing impossible dates. */
export function parseWibDate(value: string | null, endOfDay = false): WibDateResult {
  if (value === null || value === "") return { valid: true };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return { valid: false };

  const calendarDate = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(calendarDate.getTime()) || calendarDate.toISOString().slice(0, 10) !== value) {
    return { valid: false };
  }

  const time = endOfDay ? "23:59:59.999" : "00:00:00.000";
  const date = new Date(`${value}T${time}+07:00`);
  return Number.isNaN(date.getTime()) ? { valid: false } : { valid: true, date };
}
