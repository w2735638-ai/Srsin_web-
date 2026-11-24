import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import * as schema from "../drizzle/schema";
import { InsertUser, users } from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

function getTursoConfig() {
  const url =
    process.env.TURSO_DATABASE_URL ||
    process.env.DATABASE_URL ||
    process.env.TURSO_DA ||
    undefined;
  const authToken =
    process.env.TURSO_AUTH_TOKEN ||
    process.env.TURSO_AU ||
    undefined;
  return { url, authToken };
}

export async function getDb() {
  const { url, authToken } = getTursoConfig();
  if (!_db && url) {
    try {
      const client = createClient({
        url,
        authToken,
      });
      _db = drizzle(client, { schema });
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    throw new Error("Database is not available");
  }

  try {
    const now = new Date();
    const role =
      user.role !== undefined
        ? user.role
        : user.openId === ENV.ownerOpenId
          ? "admin"
          : "user";

    await db
      .insert(users)
      .values({
        openId: user.openId,
        name: user.name ?? null,
        email: user.email ?? null,
        loginMethod: user.loginMethod ?? null,
        role,
        lastSignedIn: user.lastSignedIn ?? now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: users.openId,
        set: {
          ...(user.name !== undefined ? { name: user.name } : {}),
          ...(user.email !== undefined ? { email: user.email } : {}),
          ...(user.loginMethod !== undefined ? { loginMethod: user.loginMethod } : {}),
          ...(user.role !== undefined || user.openId === ENV.ownerOpenId ? { role } : {}),
          lastSignedIn: user.lastSignedIn ?? now,
          updatedAt: now,
        },
      });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}
