import { createApp } from "./_core/index";

export interface Env {
  ASSETS?: {
    fetch: (request: Request) => Promise<Response>;
  };
  TURSO_DATABASE_URL?: string;
  TURSO_AUTH_TOKEN?: string;
  DATABASE_URL?: string;
  ADMIN_PASSWORD?: string;
  JWT_SECRET?: string;
  MANUS_PROJECT_ID?: string;
  MANUS_OAUTH_PORTAL_URL?: string;
  MANUS_API_URL?: string;
  MANUS_API_BROWSER_KEY?: string;
  [key: string]: unknown;
}

const app = createApp();

function syncRuntimeEnvToProcess(env: Env) {
  if (typeof process === "undefined") return;
  if (!process.env) {
    (process as unknown as { env: Record<string, string> }).env = {};
  }
  for (const [key, value] of Object.entries(env)) {
    if (typeof value === "string") {
      process.env[key] = value;
    }
  }
}

async function handleApiRequest(request: Request, env: Env): Promise<Response> {
  syncRuntimeEnvToProcess(env);

  const url = new URL(request.url);
  const bodyBuffer =
    request.method === "GET" || request.method === "HEAD"
      ? undefined
      : await request.arrayBuffer();

  const rawHeaders: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    rawHeaders[key.toLowerCase()] = value;
  });

  const query: Record<string, string> = {};
  url.searchParams.forEach((value, key) => {
    query[key] = value;
  });

  return new Promise<Response>((resolve) => {
    let statusCode = 200;
    const responseHeaders = new Headers();
    const chunks: Uint8Array[] = [];
    let ended = false;

    const finish = (chunk?: unknown) => {
      if (ended) return;
      ended = true;
      if (chunk !== undefined && chunk !== null) {
        if (chunk instanceof Uint8Array) {
          chunks.push(chunk);
        } else if (typeof chunk === "string") {
          chunks.push(new TextEncoder().encode(chunk));
        } else {
          chunks.push(new TextEncoder().encode(JSON.stringify(chunk)));
        }
      }
      const totalLen = chunks.reduce((sum, c) => sum + c.byteLength, 0);
      const merged = new Uint8Array(totalLen);
      let offset = 0;
      for (const c of chunks) {
        merged.set(c, offset);
        offset += c.byteLength;
      }
      resolve(
        new Response(merged.byteLength > 0 ? merged : null, {
          status: statusCode,
          headers: responseHeaders,
        }),
      );
    };

    let parsedBody: unknown = undefined;
    if (bodyBuffer && bodyBuffer.byteLength > 0) {
      const text = new TextDecoder().decode(bodyBuffer);
      const contentType = rawHeaders["content-type"] ?? "";
      if (contentType.includes("application/json")) {
        try {
          parsedBody = JSON.parse(text);
        } catch {
          parsedBody = text;
        }
      } else {
        parsedBody = text;
      }
    }

    const req: Record<string, unknown> = {
      method: request.method,
      url: url.pathname + url.search,
      originalUrl: url.pathname + url.search,
      path: url.pathname,
      headers: rawHeaders,
      query,
      body: parsedBody,
      protocol: url.protocol.replace(":", ""),
      ip: rawHeaders["cf-connecting-ip"] ?? "127.0.0.1",
      socket: { remoteAddress: rawHeaders["cf-connecting-ip"] ?? "127.0.0.1" },
      env,
      get(name: string) {
        return rawHeaders[name.toLowerCase()];
      },
      header(name: string) {
        return rawHeaders[name.toLowerCase()];
      },
    };

    const res: Record<string, unknown> = {
      statusCode: 200,
      locals: {},
      headersSent: false,
      status(code: number) {
        statusCode = code;
        this.statusCode = code;
        return this;
      },
      setHeader(name: string, value: string | string[]) {
        if (Array.isArray(value)) {
          responseHeaders.delete(name);
          for (const v of value) responseHeaders.append(name, v);
        } else {
          responseHeaders.set(name, String(value));
        }
        return this;
      },
      set(name: string, value: string | string[]) {
        return this.setHeader(name, value);
      },
      header(name: string, value: string | string[]) {
        return this.setHeader(name, value);
      },
      getHeader(name: string) {
        return responseHeaders.get(name) ?? undefined;
      },
      removeHeader(name: string) {
        responseHeaders.delete(name);
      },
      type(contentType: string) {
        responseHeaders.set("Content-Type", contentType);
        return this;
      },
      cookie(name: string, value: string, options: Record<string, unknown> = {}) {
        const parts = [`${name}=${value}`];
        if (options.maxAge !== undefined) {
          parts.push(`Max-Age=${Math.floor(Number(options.maxAge) / 1000)}`);
        }
        parts.push(`Path=${options.path ?? "/"}`);
        if (options.httpOnly) parts.push("HttpOnly");
        if (options.secure) parts.push("Secure");
        if (options.sameSite) {
          const s = String(options.sameSite);
          parts.push(`SameSite=${s.charAt(0).toUpperCase() + s.slice(1)}`);
        }
        responseHeaders.append("Set-Cookie", parts.join("; "));
        return this;
      },
      clearCookie(name: string, options: Record<string, unknown> = {}) {
        return this.cookie(name, "", { ...options, maxAge: 0 });
      },
      json(data: unknown) {
        if (!responseHeaders.has("Content-Type")) {
          responseHeaders.set("Content-Type", "application/json; charset=utf-8");
        }
        this.headersSent = true;
        finish(JSON.stringify(data));
        return this;
      },
      send(data?: unknown) {
        this.headersSent = true;
        if (typeof data === "object" && data !== null && !(data instanceof Uint8Array)) {
          if (!responseHeaders.has("Content-Type")) {
            responseHeaders.set("Content-Type", "application/json; charset=utf-8");
          }
          finish(JSON.stringify(data));
        } else {
          finish(data);
        }
        return this;
      },
      redirect(statusOrUrl: number | string, maybeUrl?: string) {
        const code = typeof statusOrUrl === "number" ? statusOrUrl : 302;
        const target = typeof statusOrUrl === "string" ? statusOrUrl : maybeUrl ?? "/";
        statusCode = code;
        responseHeaders.set("Location", target);
        this.headersSent = true;
        finish();
      },
      end(chunk?: unknown) {
        this.headersSent = true;
        finish(chunk);
      },
    };

    (app as unknown as (req: unknown, res: unknown, next: (err?: unknown) => void) => void)(
      req,
      res,
      (err?: unknown) => {
        if (err) {
          console.error("[Worker Express Error]", err);
          statusCode = 500;
          responseHeaders.set("Content-Type", "application/json");
          finish(JSON.stringify({ error: "Internal Server Error" }));
        } else if (!ended) {
          statusCode = 404;
          finish(JSON.stringify({ error: "Not Found" }));
        }
      },
    );
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/api/")) {
      return handleApiRequest(request, env);
    }

    if (env.ASSETS) {
      const assetRes = await env.ASSETS.fetch(request);
      if (assetRes.status !== 404) {
        return assetRes;
      }
      const indexUrl = new URL("/index.html", url.origin);
      return env.ASSETS.fetch(new Request(indexUrl.toString(), request));
    }

    return new Response("Not Found", { status: 404 });
  },
};
                   
