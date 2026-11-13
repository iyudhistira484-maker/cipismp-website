import { describe, expect, it, vi } from "vitest";

const { findFirst } = vi.hoisted(() => ({ findFirst: vi.fn() }));
vi.mock("@/server/db", () => ({ db: { query: { settings: { findFirst } } } }));

import { getSettings } from "@/server/settings";

describe("pengaturan selalu mengikuti database", () => {
  it("membaca perubahan dan penghapusan pengumuman tanpa cache proses", async () => {
    findFirst
      .mockResolvedValueOnce({ value: { site: { announcement: "Pengumuman pertama" } } })
      .mockResolvedValueOnce({ value: { site: { announcement: null } } })
      .mockResolvedValueOnce({ value: { site: { announcement: "Pengumuman baru" } } });

    expect((await getSettings()).site.announcement).toBe("Pengumuman pertama");
    expect((await getSettings()).site.announcement).toBeNull();
    expect((await getSettings()).site.announcement).toBe("Pengumuman baru");
    expect(findFirst).toHaveBeenCalledTimes(3);
  });
});
