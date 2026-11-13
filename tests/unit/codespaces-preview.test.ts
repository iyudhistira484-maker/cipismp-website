import { afterEach, describe, expect, it, vi } from "vitest";
import { codespacesPreviewHost, isAllowedCodespacesMutation, isCodespacesSameOriginRequest } from "@/lib/codespaces-preview";
import { NextRequest } from "next/server";
import { middleware } from "@/middleware";

const profile = {
  nodeEnv: "development", appEnv: "development", codespaces: "true", name: "sturdy-space-example",
  appUrl: "https://sturdy-space-example-3000.app.github.dev",
};
const host = "sturdy-space-example-3000.app.github.dev";
const headers = (override: Record<string, string> = {}) => new Headers({
  origin: "http://localhost:3000", "x-forwarded-host": host, "sec-fetch-site": "same-origin", ...override,
});

describe("isolasi preview Codespaces", () => {
  it("hanya aktif untuk profil development Codespaces dan URL yang tepat", () => {
    expect(codespacesPreviewHost(profile)).toBe(host);
    for (const override of [
      { nodeEnv: "production" }, { nodeEnv: "test" }, { appEnv: "production" }, { appEnv: "staging" },
      { appEnv: undefined }, { codespaces: "false" }, { name: "" }, { name: "BAD/name" },
      { domain: "app.github.dev/evil" }, { appUrl: "https://other-3000.app.github.dev" },
      { appUrl: `http://${host}` }, { appUrl: `https://user@${host}` },
    ]) expect(codespacesPreviewHost({ ...profile, ...override })).toBeNull();
  });
  it("mewajibkan localhost dari proxy, forwarded host yang tepat, dan browser same-origin", () => {
    expect(isCodespacesSameOriginRequest(headers(), host)).toBe(true);
    expect(isCodespacesSameOriginRequest(headers(), null)).toBe(false);
    expect(isCodespacesSameOriginRequest(headers({ origin: "http://evil.example" }), host)).toBe(false);
    expect(isCodespacesSameOriginRequest(headers({ "x-forwarded-host": `other.${host}` }), host)).toBe(false);
    expect(isCodespacesSameOriginRequest(headers({ "x-forwarded-host": `${host}, evil.test` }), host)).toBe(false);
    for (const site of ["cross-site", "same-site", "none", ""]) {
      expect(isCodespacesSameOriginRequest(headers({ "sec-fetch-site": site }), host)).toBe(false);
    }
    const noFetchMetadata = headers();
    noFetchMetadata.delete("sec-fetch-site");
    expect(isCodespacesSameOriginRequest(noFetchMetadata, host)).toBe(false);
  });
  it("membatasi semua mutasi browser, tetapi mempertahankan API server-to-server", () => {
    expect(isAllowedCodespacesMutation(headers(), host, "/masuk")).toBe(true);
    expect(isAllowedCodespacesMutation(headers({ origin: `https://${host}` }), host, "/admin")).toBe(true);
    expect(isAllowedCodespacesMutation(headers({ "sec-fetch-site": "cross-site" }), host, "/admin/keamanan")).toBe(false);
    expect(isAllowedCodespacesMutation(new Headers(), host, "/admin/keamanan")).toBe(false);
    expect(isAllowedCodespacesMutation(new Headers(), host, "/api/webhooks/tripay")).toBe(true);
    expect(isAllowedCodespacesMutation(headers({ "sec-fetch-site": "cross-site" }), host, "/api/orders/cancel")).toBe(false);
  });
});

const mockedEnv = vi.hoisted(() => ({ APP_URL: "https://sturdy-space-example-3000.app.github.dev" }));
vi.mock("@/server/env", () => ({ env: mockedEnv }));
import { assertSameOrigin, CsrfError } from "@/server/csrf";

describe("CSRF pada request mutasi Codespaces", () => {
  function request(h: Headers) { return new Request("http://internal/action", { method: "POST", headers: h }); }
  function enableCodespaces() {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("APP_ENV", "development");
    vi.stubEnv("APP_URL", mockedEnv.APP_URL);
    vi.stubEnv("CODESPACES", "true");
    vi.stubEnv("CODESPACE_NAME", "sturdy-space-example");
    vi.stubEnv("GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN", "app.github.dev");
  }
  afterEach(() => vi.unstubAllEnvs());

  it("menerima same-origin dari proxy Codespaces namun menolak request lintas situs", () => {
    enableCodespaces();
    expect(() => assertSameOrigin(request(headers()))).not.toThrow();
    for (const site of ["cross-site", "same-site", "none", ""]) {
      expect(() => assertSameOrigin(request(headers({ "sec-fetch-site": site })))).toThrow(CsrfError);
    }
    const noFetch = headers(); noFetch.delete("sec-fetch-site");
    expect(() => assertSameOrigin(request(noFetch))).toThrow(CsrfError);
    expect(() => assertSameOrigin(request(headers({ "x-forwarded-host": "evil.example" })))).toThrow(CsrfError);
    expect(() => assertSameOrigin(request(headers({ origin: "http://evil.example" })))).toThrow(CsrfError);
  });
  it("memblokir mutasi lintas situs sebelum seluruh Server Actions, termasuk yang tanpa guard sendiri", () => {
    enableCodespaces();
    const req = (h: Headers) => {
      h.set("cookie", "cipi_session=test-placeholder");
      return new NextRequest(`https://${host}/admin/keamanan`, { method: "POST", headers: h });
    };
    expect(middleware(req(headers())).status).toBe(200);
    expect(middleware(req(headers({ "sec-fetch-site": "cross-site" }))).status).toBe(403);
    expect(middleware(req(headers({ "sec-fetch-site": "same-site" }))).status).toBe(403);
    const noOrigin = headers(); noOrigin.delete("origin"); noOrigin.delete("sec-fetch-site");
    expect(middleware(req(noOrigin)).status).toBe(403);
    expect(middleware(req(headers({ "x-forwarded-host": "other.example" }))).status).toBe(403);
  });
  it("tidak mengaktifkan pengecualian di production, staging atau di luar Codespaces", () => {
    enableCodespaces();
    for (const [key, value] of [["NODE_ENV", "production"], ["APP_ENV", "staging"], ["CODESPACES", "false"]] as const) {
      vi.stubEnv(key, value);
      expect(() => assertSameOrigin(request(headers()))).toThrow(CsrfError);
      enableCodespaces();
    }
    expect(() => assertSameOrigin(request(headers({ origin: mockedEnv.APP_URL })))).not.toThrow();
  });
});
