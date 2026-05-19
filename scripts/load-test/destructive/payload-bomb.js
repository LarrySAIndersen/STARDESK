import http from "k6/http";
import { check } from "k6";

const BASE_URL = (__ENV.BASE_URL || "http://localhost:8000").replace(/\/+$/, "");
const BLOB = "x".repeat(256 * 1024);

export const options = {
  vus: 5,
  duration: "20s",
};

export default function () {
  const res = http.post(`${BASE_URL}/api/v1/auth/login`, BLOB, {
    headers: { "Content-Type": "application/json" },
  });
  check(res, { "server handled oversized body": (r) => r.status > 0 });
}
