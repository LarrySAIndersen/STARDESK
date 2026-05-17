/** Demo user picker on login — disable in hardened production builds. */
export function isDemoLoginEnabled(): boolean {
  const flag = process.env.NEXT_PUBLIC_ENABLE_DEMO_LOGIN?.trim().toLowerCase();
  if (flag === "true") {
    return true;
  }
  if (flag === "false") {
    return false;
  }
  return process.env.NODE_ENV === "development";
}
