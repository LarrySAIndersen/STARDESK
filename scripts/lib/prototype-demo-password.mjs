/**
 * Prototype demo password for gate/load-test scripts — not production secrets.
 * Prefer TEST_USER_PASSWORD; fall back to PROTOTYPE_DEMO_PASSWORD.
 * See apps/api/src/star_itsm_api/core/demo.py (single Python source of truth).
 */

const ENV_KEYS = ["TEST_USER_PASSWORD", "PROTOTYPE_DEMO_PASSWORD"];

/** @returns {string} */
export function requirePrototypeDemoPassword() {
  for (const key of ENV_KEYS) {
    const value = process.env[key];
    if (value) return value;
  }
  throw new Error(
    `Set one of ${ENV_KEYS.join(", ")} for prototype demo login (see docs/demo-users-and-access.md).`,
  );
}
