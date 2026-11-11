import http from "k6/http";
import { check, sleep } from "k6";

/**
 * Uji beban ringan untuk halaman katalog dan status API.
 * Jalankan: k6 run tests/load/catalog-checkout.js -e BASE_URL=https://store.cipismp.my.id
 * Bukan bagian dari CI default (butuh k6 terpasang).
 */
export const options = {
  scenarios: {
    browse: {
      executor: "ramping-vus",
      startVUs: 1,
      stages: [
        { duration: "30s", target: 20 },
        { duration: "1m", target: 20 },
        { duration: "20s", target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<800"],
  },
};

const BASE = __ENV.BASE_URL || "http://localhost:3000";

export default function () {
  const home = http.get(`${BASE}/`);
  check(home, { "home 200": (r) => r.status === 200 });

  const ranks = http.get(`${BASE}/rank`);
  check(ranks, { "rank 200": (r) => r.status === 200 });

  const kits = http.get(`${BASE}/kit`);
  check(kits, { "kit 200": (r) => r.status === 200 });

  const status = http.get(`${BASE}/api/status`);
  check(status, { "status 200": (r) => r.status === 200 });

  sleep(1);
}
