/** Nilai untuk <input type="datetime-local"> dalam zona Asia/Jakarta. */
export function toJakartaInput(date: Date): string {
  const shifted = new Date(date.getTime() + 7 * 3_600_000);
  return shifted.toISOString().slice(0, 16);
}

/** Kebalikan dari toJakartaInput: input dianggap WIB, dikembalikan sebagai Date UTC. */
export function fromJakartaInput(value: string): Date {
  return new Date(`${value}:00+07:00`);
}
