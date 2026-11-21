import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { hasAdminSession } from "../adminSession";
import { getReaderFromRequest } from "../readerAuth";
import type { ReaderSessionUser } from "../../drizzle/schema";
import { sdk } from "./sdk";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
  readerAccount: ReaderSessionUser | null;
  isAdmin: boolean;
};

export async function createContext(opts: CreateExpressContextOptions): Promise<TrpcContext> {
  let user: User | null = null;
  let readerAccount: ReaderSessionUser | null = null;
  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch {
    // Authentication is optional for public procedures.
    user = null;
  }

  readerAccount = await getReaderFromRequest(opts.req);
  opts.res.setHeader("Cache-Control", "private, no-store");

  return {
    req: opts.req,
    res: opts.res,
    user,
    readerAccount,
    isAdmin: hasAdminSession(opts.req),
  };
}
