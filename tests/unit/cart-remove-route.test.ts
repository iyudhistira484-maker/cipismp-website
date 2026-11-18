import { describe, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({ remove: vi.fn(), revalidate: vi.fn(), check: vi.fn() }));
vi.mock("@/server/cart", () => ({ removeFromCart: mock.remove }));
vi.mock("@/server/csrf", () => ({ assertSameOrigin: mock.check }));
vi.mock("next/cache", () => ({ revalidatePath: mock.revalidate }));
import { POST } from "@/app/api/cart/remove/route";

function request(itemId?: string) {
  const form = new FormData();
  if (itemId !== undefined) form.set("itemId", itemId);
  return new Request("https://store.example.test/api/cart/remove", { method: "POST", body: form });
}

describe("hapus item keranjang dengan POST/redirect/GET", () => {
  it("menghapus item yang diminta, revalidasi, lalu melakukan redirect", async () => {
    const result = await POST(request("item-1"));
    expect(mock.check).toHaveBeenCalledOnce();
    expect(mock.remove).toHaveBeenCalledWith("item-1");
    expect(mock.revalidate).toHaveBeenCalledWith("/keranjang");
    expect(mock.revalidate).toHaveBeenCalledWith("/checkout");
    expect(result.status).toBe(303);
    expect(result.headers.get("location")).toBe("/keranjang");
  });
  it("menolak origin salah dan item kosong tanpa menghapus apa pun", async () => {
    mock.remove.mockClear();
    mock.check.mockImplementationOnce(() => { throw new Error("invalid origin"); });
    expect((await POST(request("item-1"))).status).toBe(403);
    expect((await POST(request())).status).toBe(400);
    expect((await POST(request("x".repeat(257)))).status).toBe(400);
    expect(mock.remove).not.toHaveBeenCalled();
  });
});
