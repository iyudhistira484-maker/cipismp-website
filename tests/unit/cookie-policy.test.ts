import { describe, expect, it } from "vitest";
import { cookiePolicy } from "@/lib/cookie-policy";

describe("kebijakan cookie", () => {
  it("menggunakan cookie SameSite=Lax untuk deployment biasa", () => {
    expect(cookiePolicy("production", undefined)).toEqual({ httpOnly: true, secure: true, sameSite: "lax", path: "/" });
    expect(cookiePolicy("development", undefined)).toEqual({ httpOnly: true, secure: false, sameSite: "lax", path: "/" });
  });
  it("menggunakan cookie secure terpartisi hanya untuk preview development yang dipilih secara eksplisit", () => {
    expect(cookiePolicy("development", "1")).toEqual({ httpOnly: true, secure: true, sameSite: "none", partitioned: true, path: "/" });
    expect(cookiePolicy("production", "1")).toEqual({ httpOnly: true, secure: true, sameSite: "lax", path: "/" });
  });
});
