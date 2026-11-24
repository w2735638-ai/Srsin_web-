import { InsertUser } from "../drizzle/schema";
import { ENV } from "./_core/env";

function getTursoHttpConfig() {
  const rawUrl =
    process.env.TURSO_DATABASE_URL ||
    process.env.DATABASE_URL ||
    process.env.TURSO_DA ||
    "";
  const authToken =
    process.env.TURSO_AUTH_TOKEN ||
    process.env.TURSO_AU ||
    "";

  if (!rawUrl) return null;

  const baseUrl = rawUrl
    .replace(/^libsql:\/\//i, "https://")
    .replace(/\/+$/, "");

  return {
    pipelineUrl: `${baseUrl}/v2/pipeline`,
    authToken,
  };
}

function encodeArg(val: unknown): { type: "null" | "integer" | "float" | "text"; value?: string } {
  if (val === null || val === undefined) {
    return { type: "null" };
  }
  if (typeof val === "number") {
    if (Number.isInteger(val)) {
      return { type: "integer", value: String(val) };
    }
    return { type: "float", value: String(val) };
  }
  if (typeof val === "boolean") {
    return { type: "integer", value: val ? "1" : "0" };
  }
  if (val instanceof Date) {
    return { type: "integer", value: String(Math.floor(val.getTime() / 1000)) };
  }
  return { type: "text", value: String(val) };
}

function decodeCell(cell: { type?: string; value?: string | null } | undefined): unknown {
  if (!cell || cell.type === "null" || cell.value === null || cell.value === undefined) {
    return null;
  }
  if (cell.type === "integer") {
    const n = Number(cell.value);
    return Number.isSafeInteger(n) ? n : cell.value;
  }
  if (cell.type === "float") {
    return Number(cell.value);
  }
  return cell.value;
}

export async function executeTursoSql<T = Record<string, unknown>>(
  sql: string,
  args: unknown[] = []
): Promise<{ rows: T[]; rowsAffected: number }> {
  const cfg = getTursoHttpConfig();
  if (!cfg) {
    throw new Error("Database is not available");
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (cfg.authToken) {
    headers["Authorization"] = `Bearer ${cfg.authToken}`;
  }

  const response = await fetch(cfg.pipelineUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({
      requests: [
        {
          type: "execute",
          stmt: {
            sql,
            args: args.map(encodeArg),
          },
        },
        { type: "close" },
      ],
    }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throw new Error(`Turso HTTP error ${response.status}: ${errText}`);
  }

  const data = (await response.json()) as {
    results?: Array<{
      type?: string;
      error?: { message?: string };
      response?: {
        result?: {
          cols?: Array<{ name?: string }>;
          rows?: Array<Array<{ type?: string; value?: string | null }>>;
          affected_row_count?: number;
        };
      };
    }>;
  };

  const firstResult = data?.results?.[0];
  if (firstResult?.type === "error") {
    throw new Error(firstResult.error?.message || "Turso query failed");
  }

  const execResult = firstResult?.response?.result;
  const cols = execResult?.cols?.map((c, i) => c.name || `col_${i}`) || [];
  const rawRows = execResult?.rows || [];

  const rows = rawRows.map((rawRow) => {
    const obj: Record<string, unknown> = {};
    cols.forEach((colName, idx) => {
      obj[colName] = decodeCell(rawRow[idx]);
    });
    return obj as T;
  });

  return {
    rows,
    rowsAffected: execResult?.affected_row_count ?? 0,
  };
}

export async function getDb() {
  const cfg = getTursoHttpConfig();
  if (!cfg) return null;
  return { execute: executeTursoSql };
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    throw new Error("Database is not available");
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const role =
    user.role !== undefined
      ? user.role
      : user.openId === ENV.ownerOpenId
        ? "admin"
        : "user";

  const lastSignedInSec =
    user.lastSignedIn instanceof Date
      ? Math.floor(user.lastSignedIn.getTime() / 1000)
      : nowSec;

  await executeTursoSql(
    `INSERT INTO users (openId, name, email, loginMethod, role, updatedAt, lastSignedIn)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(openId) DO UPDATE SET
       name = COALESCE(excluded.name, users.name),
       email = COALESCE(excluded.email, users.email),
       loginMethod = COALESCE(excluded.loginMethod, users.loginMethod),
       role = excluded.role,
       updatedAt = excluded.updatedAt,
       lastSignedIn = excluded.lastSignedIn`,
    [
      user.openId,
      user.name ?? null,
      user.email ?? null,
      user.loginMethod ?? null,
      role,
      nowSec,
      lastSignedInSec,
    ]
  );
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const { rows } = await executeTursoSql<Record<string, unknown>>(
    `SELECT * FROM users WHERE openId = ? LIMIT 1`,
    [openId]
  );

  return rows.length > 0 ? rows[0] : undefined;
      }
