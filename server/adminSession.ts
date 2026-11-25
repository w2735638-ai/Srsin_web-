import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { Request, Response } from "express";

export const ADMIN_COOKIE = "ink_admin_session";
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

function resolveAdminPassword(req?: Request): string {
  const reqEnv = req ? (req as { env?: Record<string, string | undefined> }).env : undefined;
  return reqEnv?.ADMIN_PASSWORD ?? process.env.ADMIN_PASSWORD ?? "";
}

function sessionSignature(expiry: string, password: string) {
  return createHmac("sha256", password).update(`inknovel-admin:${expiry}`).digest("base64url");
}

function readCookie(req: Request, name: string) {
  const cookieHeader = req.headers.cookie ?? "";
  for (const pair of cookieHeader.split(";")) {
    const separator = pair.indexOf("=");
    if (separator < 0) continue;
    if (pair.slice(0, separator).trim() === name) return pair.slice(separator + 1).trim();
  }
  return "";
}

export function hasAdminSession(req: Request) {
  const password = resolveAdminPassword(req);
  if (password.length < 12) return false;
  const token = readCookie(req, ADMIN_COOKIE);
  const [expiry, signature, extra] = token.split(".");
  if (!expiry || !signature || extra !== undefined || !/^\d{13}$/.test(expiry)) return false;
  if (Number(expiry) <= Date.now()) return false;

  const expected = sessionSignature(expiry, password);
  const actualDigest = createHash("sha256").update(signature).digest();
  const expectedDigest = createHash("sha256").update(expected).digest();
  return timingSafeEqual(actualDigest, expectedDigest);
}

export function verifyAdminPassword(candidate: string, req?: Request) {
  const configured = resolveAdminPassword(req);
  if (configured.length < 12) return false;
  const expectedDigest = createHash("sha256").update(configured).digest();
  const candidateDigest = createHash("sha256").update(candidate).digest();
  return timingSafeEqual(expectedDigest, candidateDigest);
}

export function startAdminSession(res: Response, req?: Request) {
  const password = resolveAdminPassword(req);
  const expiry = String(Date.now() + SESSION_TTL_MS);
  const signature = sessionSignature(expiry, password);
  res.cookie(ADMIN_COOKIE, `${expiry}.${signature}`, {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    path: "/",
    maxAge: SESSION_TTL_MS,
  });
}

export function endAdminSession(res: Response) {
  res.clearCookie(ADMIN_COOKIE, {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    path: "/",
  });
}
