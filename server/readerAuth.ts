import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import type { Request, Response } from "express";
import { and, eq, gt } from "drizzle-orm";
import { readerAccounts, readerSessions, type ReaderSessionUser } from "../drizzle/schema";
import { getDb } from "./db";

export const READER_COOKIE = "ink_reader_session";
const SESSION_TTL_MS = 14 * 24 * 60 * 60 * 1000;
const SCRYPT_N = 32768;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LENGTH = 64;
const MAX_MEMORY = 64 * 1024 * 1024;
let dummyHashPromise: Promise<string> | undefined;

function deriveKey(password: string, salt: Buffer) {
  return new Promise<Buffer>((resolve, reject) => {
    scrypt(password, salt, KEY_LENGTH, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P, maxmem: MAX_MEMORY }, (error, key) => {
      if (error) reject(error);
      else resolve(key as Buffer);
    });
  });
}

export async function hashReaderPassword(password: string) {
  const salt = randomBytes(16);
  const key = await deriveKey(password, salt);
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString("base64url")}$${key.toString("base64url")}`;
}

async function getDummyHash() {
  dummyHashPromise ??= hashReaderPassword(randomBytes(32).toString("hex"));
  return dummyHashPromise;
}

export async function verifyReaderPassword(password: string, encodedHash?: string | null) {
  const accountExists = Boolean(encodedHash);
  const encoded = encodedHash ?? await getDummyHash();
  const parts = encoded.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt" || parts[1] !== String(SCRYPT_N) || parts[2] !== String(SCRYPT_R) || parts[3] !== String(SCRYPT_P)) {
    return false;
  }

  try {
    const salt = Buffer.from(parts[4], "base64url");
    const expected = Buffer.from(parts[5], "base64url");
    if (salt.length !== 16 || expected.length !== KEY_LENGTH) return false;
    const actual = await deriveKey(password, salt);
    return timingSafeEqual(actual, expected) && accountExists;
  } catch {
    return false;
  }
}

export async function findReaderCredentials(email: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const [account] = await db
    .select({ id: readerAccounts.id, email: readerAccounts.email, passwordHash: readerAccounts.passwordHash, coins: readerAccounts.coins })
    .from(readerAccounts)
    .where(eq(readerAccounts.email, email.trim()))
    .limit(1);
  return account ?? null;
}

export async function markReaderLogin(accountId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  await db.update(readerAccounts).set({ lastLoginAt: new Date() }).where(eq(readerAccounts.id, accountId));
}

function readCookie(req: Request) {
  for (const pair of (req.headers.cookie ?? "").split(";")) {
    const separator = pair.indexOf("=");
    if (separator >= 0 && pair.slice(0, separator).trim() === READER_COOKIE) {
      return pair.slice(separator + 1).trim();
    }
  }
  return "";
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function startReaderSession(accountId: number, res: Response) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.insert(readerSessions).values({ accountId, tokenHash: hashToken(token), expiresAt });
  res.cookie(READER_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "none",
    path: "/",
    maxAge: SESSION_TTL_MS,
  });
}

export async function getReaderFromRequest(req: Request): Promise<ReaderSessionUser | null> {
  const token = readCookie(req);
  if (!token) return null;
  const db = await getDb();
  if (!db) return null;
  const [account] = await db
    .select({ id: readerAccounts.id, email: readerAccounts.email, coins: readerAccounts.coins })
    .from(readerSessions)
    .innerJoin(readerAccounts, eq(readerSessions.accountId, readerAccounts.id))
    .where(and(eq(readerSessions.tokenHash, hashToken(token)), gt(readerSessions.expiresAt, new Date())))
    .limit(1);
  return account ?? null;
}

export async function endReaderSession(req: Request, res: Response) {
  const token = readCookie(req);
  if (token) {
    const db = await getDb();
    if (db) await db.delete(readerSessions).where(eq(readerSessions.tokenHash, hashToken(token)));
  }
  res.clearCookie(READER_COOKIE, { httpOnly: true, secure: true, sameSite: "none", path: "/" });
}
