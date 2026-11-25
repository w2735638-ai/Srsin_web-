import { createClient, type Client } from "@libsql/client/web";
import { eq } from "drizzle-orm";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "../drizzle/schema";
import { users, type InsertUser } from "../drizzle/schema";
import { getEnv, type RuntimeEnvSource } from "./_core/env";

export type AppDatabase = LibSQLDatabase<typeof schema>;

let _client: Client | null = null;
let _db: AppDatabase | null = null;
let _cachedConfigKey = "";

export async function getDb(runtimeEnv?: RuntimeEnvSource): Promise<AppDatabase | null> {
  const env = getEnv(runtimeEnv);
  const url = env.databaseUrl;
  const authToken = env.databaseAuthToken;

  if (!url) {
    console.warn("[Database] Missing TURSO_DATABASE_URL / DATABASE_URL");
    return null;
  }

  const configKey = `${url}::${authToken}`;
  if (_db && _cachedConfigKey === configKey) {
    return _db;
  }

  try {
    _client = createClient({
      url,
      ...(authToken ? { authToken } : {}),
    });
    _db = drizzle(_client, { schema });
    _cachedConfigKey = configKey;
    return _db;
  } catch (error) {
    console.error("[Database] Failed to initialize libsql client:", error);
    _client = null;
    _db = null;
    _cachedConfigKey = "";
    return null;
  }
}

export async function upsertUser(user: InsertUser, runtimeEnv?: RuntimeEnvSource): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb(runtimeEnv);
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.openId, user.openId))
      .limit(1);

    const now = new Date();
    const values: InsertUser = {
      openId: user.openId,
      name: user.name ?? null,
      email: user.email ?? null,
      loginMethod: user.loginMethod ?? null,
      role: user.role ?? (user.openId === getEnv(runtimeEnv).ownerOpenId ? "admin" : "user"),
      lastSignedIn: user.lastSignedIn ?? now,
    };

    if (existing.length > 0) {
      await db
        .update(users)
        .set({
          name: values.name,
          email: values.email,
          loginMethod: values.loginMethod,
          lastSignedIn: values.lastSignedIn,
          updatedAt: now,
        })
        .where(eq(users.openId, user.openId));
    } else {
      await db.insert(users).values({
        ...values,
        createdAt: now,
        updatedAt: now,
      });
    }
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string, runtimeEnv?: RuntimeEnvSource) {
  const db = await getDb(runtimeEnv);
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}
