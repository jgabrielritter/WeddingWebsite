export type AdminAuthResult = {
  ok: boolean;
  reason?: string;
};

function decodeBase64(value: string): string {
  if (typeof atob === "function") {
    return atob(value);
  }
  return Buffer.from(value, "base64").toString("utf-8");
}

export function isAdminAuthorized(authHeader: string | null): AdminAuthResult {
  const adminSecret = process.env.ADMIN_SECRET;
  const adminUser = process.env.ADMIN_USER ?? "admin";

  if (!adminSecret) {
    return { ok: false, reason: "ADMIN_SECRET missing" };
  }

  if (!authHeader) {
    return { ok: false, reason: "missing authorization" };
  }

  const [scheme, encoded] = authHeader.split(" ");
  if (scheme?.toLowerCase() !== "basic" || !encoded) {
    return { ok: false, reason: "invalid auth scheme" };
  }

  let decoded = "";
  try {
    decoded = decodeBase64(encoded);
  } catch (error) {
    return { ok: false, reason: "invalid encoding" };
  }
  const [user, pass] = decoded.split(":");

  if (user !== adminUser || pass !== adminSecret) {
    return { ok: false, reason: "invalid credentials" };
  }

  return { ok: true };
}
