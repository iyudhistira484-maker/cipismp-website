import { afterEach, describe, expect, it, vi } from "vitest";
import { sendToPlugin, signPluginRequest } from "@/server/delivery/plugin-client";
import { verifyPluginSignature } from "@/server/delivery/plugin-auth";

const SECRET = "test-plugin-secret-0123456789abcdef";
const request = {
  baseUrl: "http://minecraft.internal:8081/",
  secret: SECRET,
  deliveryId: "del_1",
  uuid: "33333333-3333-4333-8333-333333333333",
  playerName: "CipiTest",
  commands: ["lp user CipiTest parent add iron"],
  reason: "PURCHASE" as const,
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("website → companion plugin delivery protocol", () => {
  it("menghasilkan fixture HMAC wire-format yang sama dengan Java plugin", () => {
    const body =
      '{"deliveryId":"del_1","uuid":"33333333-3333-4333-8333-333333333333","player":"CipiTest","commands":["lp user CipiTest parent add iron"],"reason":"PURCHASE"}';
    expect(signPluginRequest(SECRET, "1762900000", "abc123", body)).toBe(
      "0082f0749dfa5108e9f2b4a3ee9c07942cd3d5c713687c5b2dcfa40456654264",
    );
  });

  it("mengirim route, payload, dan HMAC yang kompatibel dengan server/plugin", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ ok: true, applied: 1, failed: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(sendToPlugin(request)).resolves.toEqual({ ok: true, applied: 1, failed: [] });

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe("http://minecraft.internal:8081/cipismp/deliver");
    expect(init?.method).toBe("POST");
    expect(init?.headers).toMatchObject({ "Content-Type": "application/json" });
    const body = String(init?.body);
    expect(JSON.parse(body)).toEqual({
      deliveryId: "del_1",
      uuid: "33333333-3333-4333-8333-333333333333",
      player: "CipiTest",
      commands: ["lp user CipiTest parent add iron"],
      reason: "PURCHASE",
    });

    const headers = new Headers(init?.headers);
    expect(
      verifyPluginSignature({
        secret: SECRET,
        timestamp: headers.get("X-Cipi-Timestamp") ?? "",
        nonce: headers.get("X-Cipi-Nonce") ?? "",
        signature: headers.get("X-Cipi-Signature") ?? "",
        body,
      }).ok,
    ).toBe(true);
  });

  it("menolak respons HTTP gagal dan respons JSON yang tidak sesuai kontrak", async () => {
    const rejected = vi.fn<typeof fetch>().mockResolvedValue(new Response("server down", { status: 503 }));
    vi.stubGlobal("fetch", rejected);
    await expect(sendToPlugin(request)).rejects.toThrow("Plugin menolak request (503)");

    const malformed = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify({ applied: 0 }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", malformed);
    await expect(sendToPlugin(request)).rejects.toThrow("Respons plugin tidak valid");
  });
});
