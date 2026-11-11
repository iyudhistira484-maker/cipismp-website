import { randomBytes } from "node:crypto";

/** ID berurutan waktu + acak, aman untuk diindeks (mis. ord_m8x2k...). */
export function newId(prefix: string): string {
  const time = Date.now().toString(36);
  const rand = randomBytes(9).toString("base64url").replace(/[-_]/g, "x");
  return `${prefix}_${time}${rand}`;
}

export const ids = {
  user: () => newId("usr"),
  session: () => newId("ses"),
  token: () => newId("tok"),
  product: () => newId("prd"),
  kitItem: () => newId("kit"),
  season: () => newId("sn"),
  order: () => newId("ord"),
  orderItem: () => newId("oit"),
  payment: () => newId("pay"),
  paymentEvent: () => newId("pev"),
  delivery: () => newId("dlv"),
  deliveryAttempt: () => newId("dat"),
  coupon: () => newId("cpn"),
  cart: () => newId("crt"),
  cartItem: () => newId("cit"),
  audit: () => newId("aud"),
  notification: () => newId("ntf"),
  job: () => newId("job"),
  email: () => newId("eml"),
  entitlement: () => newId("ent"),
  minecraft: () => newId("mcp"),
  loginAttempt: () => newId("lat"),
  nonce: () => newId("non"),
  couponRedemption: () => newId("crx"),
  legal: () => newId("lgl"),
};
