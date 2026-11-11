import { randomUUID } from "node:crypto";

/** Cek ketersediaan database test; integration test di-skip bila tidak ada. */
export function databaseUrl(): string | null {
  // TEST_DB diisi tests/setup.ts hanya bila penguji memberi database test eksplisit,
  // sehingga `npm test` tanpa database tetap lulus (integration di-skip).
  return process.env.TEST_DB && process.env.TEST_DB.length > 0 ? process.env.TEST_DB : null;
}

export function uniqueSuffix(): string {
  return randomUUID().slice(0, 8);
}
