import http from "k6/http";
import { check } from "k6";

const BASE_URL = (__ENV.BASE_URL || "http://localhost:8000").replace(/\/+$/, "");
const smoke = __ENV.SPIKE_SMOKE === "1";

export const options = {
  scenarios: {
    spike: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: smoke
        ? [
            { duration: "5s", target: 2 },
            { duration: "5s", target: 5 },
            { duration: "5s", target: 1 },
          ]
        : [
            { duration: "10s", target: 5 },
        { duration: "20s", target: 80 },
        { duration: "10s", target: 5 },
      ],
      gracefulRampDown: "5s",
    },
  },
  thresholds: {
    http_req_failed: ["rate<0.5"],
  },
};

export default function () {
  const res = http.get(`${BASE_URL}/health`);
  check(res, { "health reachable": (r) => r.status > 0 });
}
