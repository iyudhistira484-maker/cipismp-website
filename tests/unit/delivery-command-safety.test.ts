import { describe, expect, it } from "vitest";
import { deliveryCommandsAreSafe } from "@/server/delivery/command-safety";

const uuid = "33333333-3333-4333-8333-333333333333";
const safe = (command: string) => deliveryCommandsAreSafe([command], "CipiPlayer", uuid);

describe("pembatasan perintah pengiriman", () => {
  it("mengizinkan hanya rank dan permission kit yang ditetapkan untuk penerima", () => {
    expect(safe("lp user CipiPlayer parent add vip")).toBe(true);
    expect(safe(`lp user ${uuid} parent remove legend`)).toBe(true);
    expect(safe("lp user CipiPlayer permission set playerkits.kits.cipi++ true")).toBe(true);
    expect(safe("lp user CipiPlayer permission unset playerkits.kits.cipiprime")).toBe(true);
  });
  it("menolak penambahan, pencabutan, atau penggantian grup freerank milik event", () => {
    expect(safe("lp user CipiPlayer parent add freerank")).toBe(false);
    expect(safe("lp user CipiPlayer parent remove freerank")).toBe(false);
    expect(safe("lp user CipiPlayer parent set default")).toBe(false);
    expect(deliveryCommandsAreSafe(["lp user CipiPlayer parent remove vip", "lp user CipiPlayer parent add mvp"], "CipiPlayer", uuid)).toBe(true);
  });
  it("menolak set/clear group, group staf, target lain, alias, perintah arbitrer dan injeksi", () => {
    for (const c of ["lp user CipiPlayer parent set vip", "lp user CipiPlayer parent remove admin", "lp user someone parent add vip", "luckperms user CipiPlayer parent add vip", "op CipiPlayer", "lp user CipiPlayer parent add vip\nop someone", "lp user CipiPlayer permission set * true", "lp user CipiPlayer permission set playerkits.kits.cipiprime false"]) expect(safe(c), c).toBe(false);
    expect(deliveryCommandsAreSafe([], "CipiPlayer", uuid)).toBe(false);
    expect(deliveryCommandsAreSafe(["lp user CipiPlayer parent add vip"], "CipiPlayer", "invalid")).toBe(false);
  });
});
