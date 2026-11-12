import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ current: vi.fn() }));
vi.mock("@/server/auth/session", () => ({ getCurrentSession: mocks.current }));
vi.mock("next/navigation", () => ({ redirect: (path: string) => { throw new Error(`redirect:${path}`); } }));
import { getViewer, requireStaff, requirePermissionApi } from "@/server/auth/guard";

const user = { id: "u", email: "u@example.test", username: "owner", displayName: null, role: "OWNER" as const, emailVerifiedAt: new Date(), totpEnabledAt: new Date(), createdAt: new Date() };

describe("gerbang 2FA dan bootstrap staf", () => {
  beforeEach(() => mocks.current.mockReset());
  it("menolak sesi yang belum menyelesaikan 2FA dari viewer, halaman, dan action admin", async () => {
    mocks.current.mockResolvedValue({ user, session: { id: "s", mfaSatisfiedAt: null } });
    expect(await getViewer()).toBeNull();
    await expect(requireStaff("orders.read")).rejects.toThrow("redirect:/masuk/2fa");
    await expect(requirePermissionApi("orders.read")).rejects.toThrow("Kamu harus masuk");
  });
  it("mengizinkan sesi yang telah menyelesaikan 2FA", async () => {
    mocks.current.mockResolvedValue({ user, session: { id: "s", mfaSatisfiedAt: new Date() } });
    expect(await requireStaff("orders.read")).toMatchObject({ sessionId: "s", user: { id: "u" } });
    expect(await requirePermissionApi("orders.read")).toMatchObject({ sessionId: "s" });
  });
  it("mengizinkan bootstrap keamanan tetapi membatasi data dan action staf sebelum 2FA disetel", async () => {
    mocks.current.mockResolvedValue({ user: { ...user, totpEnabledAt: null }, session: { id: "s", mfaSatisfiedAt: null } });
    expect(await requireStaff()).toMatchObject({ sessionId: "s" });
    await expect(requireStaff("orders.read")).rejects.toThrow("redirect:/admin/keamanan");
    await expect(requirePermissionApi("orders.read")).rejects.toThrow("Aktifkan 2FA");
  });
});
