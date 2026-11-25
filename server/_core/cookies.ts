import type { CookieOptions, Request } from "express";

export function getSessionCookieOptions(req: Request): CookieOptions {
  const proto = String(req.headers["x-forwarded-proto"] ?? "");
  const isHttps = proto.includes("https") || req.protocol === "https" || process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    path: "/",
    sameSite: isHttps ? "none" : "lax",
    secure: isHttps,
  };
}
