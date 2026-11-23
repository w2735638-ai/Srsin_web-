import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { registerOAuthRoutes } from "./oauth";
import { publicPlatformScript } from "./publicConfig";
import { appRouter } from "../routers";
import { createContext } from "./context";

type HandlerFn = (req: any, res: any, next?: any) => unknown;
interface RegisteredRoute {
  method: string;
  path: string;
  handlers: HandlerFn[];
}

function createMiniExpressApp() {
  const routes: RegisteredRoute[] = [];

  const addRoute = (method: string, path: string, ...handlers: HandlerFn[]) => {
    routes.push({ method: method.toUpperCase(), path, handlers });
  };

  return {
    routes,
    use(pathOrHandler: string | HandlerFn, ...handlers: HandlerFn[]) {
      if (typeof pathOrHandler === "function") {
        routes.push({ method: "ALL", path: "*", handlers: [pathOrHandler, ...handlers] });
      } else {
        routes.push({ method: "ALL", path: pathOrHandler, handlers });
      }
      return this;
    },
    get(path: string, ...handlers: HandlerFn[]) {
      addRoute("GET", path, ...handlers);
      return this;
    },
    post(path: string, ...handlers: HandlerFn[]) {
      addRoute("POST", path, ...handlers);
      return this;
    },
    put(path: string, ...handlers: HandlerFn[]) {
      addRoute("PUT", path, ...handlers);
      return this;
    },
    delete(path: string, ...handlers: HandlerFn[]) {
      addRoute("DELETE", path, ...handlers);
      return this;
    },
  };
}

const miniApp = createMiniExpressApp();
registerOAuthRoutes(miniApp as any);

async function runMatchedRoutes(request: Request, url: URL): Promise<Response | null> {
  const method = request.method.toUpperCase();
  const matched = miniApp.routes.filter((r) => {
    const methodOk = r.method === "ALL" || r.method === method;
    if (!methodOk) return false;
    if (r.path === "*") return true;
    return url.pathname === r.path || url.pathname.startsWith(r.path.endsWith("/") ? r.path : r.path + "/");
  });

  if (matched.length === 0) return null;

  const headers: Record<string, string> = {};
  request.headers.forEach((v, k) => {
    headers[k.toLowerCase()] = v;
  });

  let parsedBody: unknown = undefined;
  if (method !== "GET" && method !== "HEAD") {
    const rawText = await request.text();
    if (rawText) {
      if ((headers["content-type"] || "").includes("application/json")) {
        try {
          parsedBody = JSON.parse(rawText);
        } catch {
          parsedBody = {};
        }
      } else {
        parsedBody = rawText;
      }
    }
  }

  const query: Record<string, string> = {};
  url.searchParams.forEach((v, k) => {
    query[k] = v;
  });

  return await new Promise<Response | null>((resolve, reject) => {
    let statusCode = 200;
    const outHeaders = new Headers();
    const chunks: Uint8Array[] = [];
    let finished = false;

    const req: any = {
      method,
      url: url.pathname + url.search,
      originalUrl: url.pathname + url.search,
      path: url.pathname,
      headers,
      query,
      body: parsedBody,
      get(name: string) {
        return headers[name.toLowerCase()];
      },
      header(name: string) {
        return headers[name.toLowerCase()];
      },
    };

    const res: any = {
      statusCode: 200,
      status(code: number) {
        statusCode = code;
        this.statusCode = code;
        return this;
      },
      setHeader(name: string, val: string | string[]) {
        if (Array.isArray(val)) {
          outHeaders.delete(name);
          for (const item of val) outHeaders.append(name, item);
        } else {
          outHeaders.set(name, String(val));
        }
        return this;
      },
      getHeader(name: string) {
        return outHeaders.get(name) ?? undefined;
      },
      set(field: string | Record<string, string>, val?: string) {
        if (typeof field === "string" && val !== undefined) {
          this.setHeader(field, val);
        } else if (typeof field === "object") {
          for (const [k, v] of Object.entries(field)) this.setHeader(k, v);
        }
        return this;
      },
      type(t: string) {
        this.setHeader("content-type", t);
        return this;
      },
      cookie(name: string, value: string, options?: Record<string, any>) {
        const parts = [`${name}=${encodeURIComponent(value)}`];
        if (options?.maxAge) parts.push(`Max-Age=${Math.floor(options.maxAge / 1000)}`);
        if (options?.httpOnly) parts.push("HttpOnly");
        if (options?.sameSite) parts.push(`SameSite=${options.sameSite}`);
        if (options?.path) parts.push(`Path=${options.path}`);
        outHeaders.append("set-cookie", parts.join("; "));
        return this;
      },
      clearCookie(name: string, options?: Record<string, any>) {
        const path = options?.path || "/";
        outHeaders.append("set-cookie", `${name}=; Max-Age=0; Path=${path}`);
        return this;
      },
      redirect(statusOrUrl: number | string, maybeUrl?: string) {
        const code = typeof statusOrUrl === "number" ? statusOrUrl : 302;
        const target = typeof statusOrUrl === "string" ? statusOrUrl : maybeUrl || "/";
        statusCode = code;
        outHeaders.set("location", target);
        this.end();
        return this;
      },
      json(obj: unknown) {
        if (!outHeaders.has("content-type")) {
          outHeaders.set("content-type", "application/json; charset=utf-8");
        }
        chunks.push(new TextEncoder().encode(JSON.stringify(obj)));
        this.end();
        return this;
      },
      send(body?: unknown) {
        if (body !== undefined && body !== null) {
          if (typeof body === "string") {
            chunks.push(new TextEncoder().encode(body));
          } else if (body instanceof Uint8Array) {
            chunks.push(body);
          } else {
            if (!outHeaders.has("content-type")) {
              outHeaders.set("content-type", "application/json; charset=utf-8");
            }
            chunks.push(new TextEncoder().encode(JSON.stringify(body)));
          }
        }
        this.end();
        return this;
      },
      end(chunk?: unknown) {
        if (finished) return this;
        finished = true;
        if (chunk !== undefined && chunk !== null) {
          chunks.push(
            chunk instanceof Uint8Array ? chunk : new TextEncoder().encode(String(chunk))
          );
        }
        const totalLen = chunks.reduce((acc, c) => acc + c.length, 0);
        const merged = new Uint8Array(totalLen);
        let offset = 0;
        for (const c of chunks) {
          merged.set(c, offset);
          offset += c.length;
        }
        resolve(new Response(merged, { status: statusCode, headers: outHeaders }));
        return this;
      },
    };

    const handlerQueue: HandlerFn[] = [];
    for (const r of matched) {
      handlerQueue.push(...r.handlers);
    }

    let idx = 0;
    const next = (err?: unknown) => {
      if (err) {
        reject(err);
        return;
      }
      if (finished) return;
      const fn = handlerQueue[idx++];
      if (!fn) {
        resolve(null);
        return;
      }
      try {
        const maybePromise = fn(req, res, next);
        if (maybePromise && typeof (maybePromise as Promise<unknown>).catch === "function") {
          (maybePromise as Promise<unknown>).catch(reject);
        }
      } catch (e) {
        reject(e);
      }
    };

    next();
  });
}

export default {
  async fetch(request: Request, env: Record<string, unknown>): Promise<Response> {
    for (const [key, value] of Object.entries(env)) {
      if (typeof value === "string") {
        process.env[key] = value;
      }
    }

    const url = new URL(request.url);

    if (url.pathname === "/api/health") {
      return new Response(JSON.stringify({ status: "ok" }), {
        status: 200,
        headers: { "content-type": "application/json; charset=utf-8" },
      });
    }

    if (url.pathname === "/api/platform/config.js") {
      return new Response(publicPlatformScript(), {
        status: 200,
        headers: {
          "content-type": "application/javascript; charset=utf-8",
          "cache-control": "no-store",
        },
      });
    }

    if (url.pathname.startsWith("/api/trpc")) {
      return await fetchRequestHandler({
        endpoint: "/api/trpc",
        req: request,
        router: appRouter,
        createContext: async ({ req: trpcReq }) => {
          return await createContext({ req: trpcReq as any, res: {} as any, info: {} as any } as any);
        },
      });
    }

    const matchedResponse = await runMatchedRoutes(request, url);
    if (matchedResponse) {
      return matchedResponse;
    }

    return new Response("Not Found", { status: 404 });
  },
};
        
