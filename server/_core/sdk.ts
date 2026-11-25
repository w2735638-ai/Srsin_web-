import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { parse as parseCookieHeader } from "cookie";
import type { Request } from "express";
import { SignJWT, jwtVerify } from "jose";
import type { User } from "../../drizzle/schema";
import * as db from "../db";
import { getEnv, type RuntimeEnvSource } from "./env";

export type SessionPayload = {
  openId: string;
  appId: string;
  name: string;
};

class SDKServer {
  private getSessionSecret(runtimeEnv?: RuntimeEnvSource) {
    const secret = getEnv(runtimeEnv).cookieSecret || "inknovel-dev-secret-change-in-production";
    return new TextEncoder().encode(secret);
  }

  public parseCookies(cookieHeader: string | undefined): Map<string, string> {
    if (!cookieHeader) {
      return new Map<string, string>();
    }
    const parsed = parseCookieHeader(cookieHeader);
    return new Map(Object.entries(parsed));
  }

  public async createSessionToken(
    openId: string,
    options: { expiresInMs?: number; name?: string; runtimeEnv?: RuntimeEnvSource } = {},
  ): Promise<string> {
    const issuedAt = Date.now();
    const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
    const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1000);
    const secretKey = this.getSessionSecret(options.runtimeEnv);
    const appId = getEnv(options.runtimeEnv).appId || "inknovel";

    return new SignJWT({
      openId,
      appId,
      name: options.name || "",
    })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setExpirationTime(expirationSeconds)
      .sign(secretKey);
  }

  public async verifySession(
    cookieValue: string | undefined | null,
    runtimeEnv?: RuntimeEnvSource,
  ): Promise<SessionPayload | null> {
    if (!cookieValue) {
      return null;
    }

    try {
      const secretKey = this.getSessionSecret(runtimeEnv);
      const { payload } = await jwtVerify(cookieValue, secretKey, {
        algorithms: ["HS256"],
      });
      const { openId, appId, name } = payload as Record<string, unknown>;
      if (typeof openId !== "string" || openId.length === 0) {
        return null;
      }
      return {
        openId,
        appId: typeof appId === "string" ? appId : "",
        name: typeof name === "string" ? name : "",
      };
    } catch {
      return null;
    }
  }

  public async authenticateRequest(
    req: Request,
    runtimeEnv?: RuntimeEnvSource,
  ): Promise<User | null> {
    const cookies = this.parseCookies(req.headers.cookie);
    const sessionCookie = cookies.get(COOKIE_NAME);
    const session = await this.verifySession(sessionCookie, runtimeEnv);

    if (!session) {
      return null;
    }

    const signedInAt = new Date();
    let user = await db.getUserByOpenId(session.openId, runtimeEnv);

    if (!user) {
      try {
        await db.upsertUser(
          {
            openId: session.openId,
            name: session.name || null,
            lastSignedIn: signedInAt,
          },
          runtimeEnv,
        );
        user = await db.getUserByOpenId(session.openId, runtimeEnv);
      } catch {
        return null;
      }
    }

    return user ?? null;
  }
}

export const sdk = new SDKServer();
