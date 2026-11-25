import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import type { RuntimeEnvSource } from "./env";
import { sdk } from "./sdk";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
  env?: RuntimeEnvSource;
};

export async function createContext(
  opts: CreateExpressContextOptions,
): Promise<TrpcContext> {
  const runtimeEnv = (opts.req as { env?: RuntimeEnvSource }).env;
  let user: User | null = null;

  try {
    user = await sdk.authenticateRequest(opts.req, runtimeEnv);
  } catch {
    user = null;
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
    env: runtimeEnv,
  };
}
