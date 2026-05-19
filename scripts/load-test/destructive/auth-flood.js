import http from "k6/http";
import { check } from "k6";

const BASE_URL = (__ENV.BASE_URL || "http://localhost:8000").replace(/\/+$/, "");

export const options = {
  scenarios: {
    auth_flood: {
      executor: "constant-arrival-rate",
      rate: 50,
      timeUnit: "1s",
      duration: "30s",
      preAllocatedVUs: 20,
      maxVUs: 100,
    },
  },
};

export default function () {
  const payload = JSON.stringify({
    email: `flood-${__VU}-${__ITER}@invalid.example`,
    password: "not-a-real-password",
  });
  const res = http.post(`${BASE_URL}/api/v1/auth/login`, payload, {
    headers: { "Content-Type": "application/json" },
  });
  check(res, { "login endpoint responded": (r) => r.status > 0 });
}
