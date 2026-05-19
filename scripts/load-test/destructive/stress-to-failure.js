import http from "k6/http";
import { check } from "k6";

const BASE_URL = (__ENV.BASE_URL || "http://localhost:8000").replace(/\/+$/, "");

export const options = {
  scenarios: {
    ramp_to_failure: {
      executor: "ramping-vus",
      startVUs: 1,
      stages: [
        { duration: "30s", target: 20 },
        { duration: "30s", target: 60 },
        { duration: "30s", target: 120 },
        { duration: "30s", target: 200 },
      ],
      gracefulRampDown: "10s",
    },
  },
};

export default function () {
  const res = http.get(`${BASE_URL}/api/v1/tickets`, {
    headers: { authorization: "Bearer invalid-token-on-purpose" },
  });
  check(res, { "responded": (r) => r.status > 0 });
}
