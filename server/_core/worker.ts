import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { publicPlatformScript } from "./publicConfig";
import { appRouter } from "../routers";
import { createContext } from "./context";

function createApp() {
  const app = express();
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
  app.get("/api/platform/config.js", (_req, res) => {
    res
      .set("Cache-Control", "no-store")
      .type("application/javascript")
      .send(publicPlatformScript());
  });

  registerOAuthRoutes(app);

  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  return app;
}

const app = createApp();

export default {
  async fetch(request: Request, env: Record<string, unknown>): Promise<Response> {
    // Sync Cloudflare Worker env/secrets into process.env for server/db code
    for (const [key, value] of Object.entries(env)) {
      if (typeof value === "string") {
        process.env[key] = value;
      }
    }

    const url = new URL(request.url);
    const headers: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      headers[key] = value;
    });

    const rawBody =
      request.method !== "GET" && request.method !== "HEAD"
        ? Buffer.from(await request.arrayBuffer())
        : undefined;

    return await new Promise<Response>((resolve, reject) => {
      let statusCode = 200;
      const resHeaders: Record<string, string | string[]> = {};
      const chunks: Buffer[] = [];

      const req: any = {
        method: request.method,
        url: url.pathname + url.search,
        originalUrl: url.pathname + url.search,
        headers,
        body: undefined,
      };

      // Pass raw/parsed body cleanly for express json/urlencoded/trpc
      if (rawBody && rawBody.length > 0) {
        const contentType = headers["content-type"] || "";
        if (contentType.includes("application/json")) {
          try {
            req.body = JSON.parse(rawBody.toString("utf-8"));
          } catch {
            req.body = {};
          }
        } else {
          req.body = rawBody.toString("utf-8");
        }
      }

      const res: any = {
        statusCode: 200,
        headersSent: false,
        setHeader(name: string, val: string | string[]) {
          resHeaders[name.toLowerCase()] = val;
        },
        getHeader(name: string) {
          return resHeaders[name.toLowerCase()];
        },
        removeHeader(name: string) {
          delete resHeaders[name.toLowerCase()];
        },
        set(field: string | Record<string, string>, val?: string) {
          if (typeof field === "string" && val !== undefined) {
            this.setHeader(field, val);
          } else if (typeof field === "object") {
            for (const [k, v] of Object.entries(field)) {
              this.setHeader(k, v);
            }
          }
          return this;
        },
        type(t: string) {
          this.setHeader("content-type", t);
          return this;
        },
        status(code: number) {
          statusCode = code;
          this.statusCode = code;
          return this;
        },
        send(body?: unknown) {
          if (body !== undefined && body !== null) {
            if (Buffer.isBuffer(body)) {
              chunks.push(body);
            } else if (typeof body === "string") {
              chunks.push(Buffer.from(body, "utf-8"));
            } else {
              if (!this.getHeader("content-type")) {
                this.setHeader("content-type", "application/json");
              }
              chunks.push(Buffer.from(JSON.stringify(body), "utf-8"));
            }
          }
          this.end();
          return this;
        },
        json(obj: unknown) {
          if (!this.getHeader("content-type")) {
            this.setHeader("content-type", "application/json");
          }
          chunks.push(Buffer.from(JSON.stringify(obj), "utf-8"));
          this.end();
          return this;
        },
        end(chunk?: unknown) {
          if (this.headersSent) return;
          this.headersSent = true;
          if (chunk !== undefined && chunk !== null) {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk), "utf-8"));
          }

          const outHeaders = new Headers();
          for (const [k, v] of Object.entries(resHeaders)) {
            if (Array.isArray(v)) {
              for (const item of v) outHeaders.append(k, item);
            } else if (v !== undefined) {
              outHeaders.set(k, String(v));
            }
          }

          resolve(
            new Response(Buffer.concat(chunks), {
              status: statusCode,
              headers: outHeaders,
            })
          );
        },
      };

      // Add minimal event emitter methods Express expects
      const listeners: Record<string, Array<(...args: any[]) => void>> = {};
      req.on = (ev: string, fn: (...args: any[]) => void) => {
        listeners[ev] = listeners[ev] || [];
        listeners[ev].push(fn);
        return req;
      };
      req.emit = (ev: string, ...args: any[]) => {
        for (const fn of listeners[ev] || []) fn(...args);
        return true;
      };
      res.on = (ev: string, fn: (...args: any[]) => void) => {
        listeners[`res:${ev}`] = listeners[`res:${ev}`] || [];
        listeners[`res:${ev}`].push(fn);
        return res;
      };
      res.emit = (ev: string, ...args: any[]) => {
        for (const fn of listeners[`res:${ev}`] || []) fn(...args);
        return true;
      };

      try {
        app(req, res, (err: unknown) => {
          if (err) reject(err);
          else resolve(new Response("Not Found", { status: 404 }));
        });
      } catch (err) {
        reject(err);
      }
    });
  },
};
      
