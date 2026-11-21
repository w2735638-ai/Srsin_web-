import { TRPCError } from "@trpc/server";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, readerProcedure, router } from "./_core/trpc";
import { endAdminSession, startAdminSession, verifyAdminPassword } from "./adminSession";
import { clearAdminLoginFailures, isAdminLoginBlocked, recordFailedAdminLogin } from "./adminLoginThrottle";
import { clearReaderLoginFailures, isReaderLoginBlocked, recordReaderLoginFailure } from "./accountLoginThrottle";
import {
  createReaderAccount as createManagedReaderAccount,
  getReaderChapter,
  listAdminChapters,
  listReaderAccounts,
  setChapterPricing,
  topUpReaderCoins,
  unlockReaderChapter,
} from "./coinStore";
import { createNovel, getNovelWithChapters, listNovels, publishChapter, updateNovel } from "./novelStore";
import { decodeNovelCoverPayload, isValidNovelCoverSource, MAX_NOVEL_COVER_BASE64_CHARS, NOVEL_COVER_MIME_TYPES, storeNovelCover } from "./novelCoverStorage";
import { hashReaderPassword, findReaderCredentials, markReaderLogin, verifyReaderPassword, startReaderSession, endReaderSession } from "./readerAuth";
import { NOVEL_GENRES } from "../drizzle/schema";
import { z } from "zod";

const adminProcedure = publicProcedure.use(({ ctx, next }) => {
  if (!ctx.isAdmin) throw new TRPCError({ code: "UNAUTHORIZED", message: "Admin sign-in required." });
  return next({ ctx: { ...ctx, isAdmin: true as const } });
});

function clientAddress(ctx: { req: { ip?: string; socket: { remoteAddress?: string } } }) {
  return ctx.req.ip || ctx.req.socket.remoteAddress || "unknown";
}

const novelCoverSource = z.string().trim().max(2000).refine(isValidNovelCoverSource, "Use a complete HTTP(S) image URL or an uploaded project cover.");

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  account: router({
    me: publicProcedure.query(({ ctx }) => ctx.readerAccount),
    login: publicProcedure
      .input(z.object({ email: z.string().trim().email().max(320), password: z.string().min(1).max(128) }))
      .mutation(async ({ input, ctx }) => {
        const address = clientAddress(ctx);
        if (isReaderLoginBlocked(address)) {
          throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Too many sign-in attempts. Try again in 15 minutes." });
        }
        const account = await findReaderCredentials(input.email);
        if (!(await verifyReaderPassword(input.password, account?.passwordHash))) {
          recordReaderLoginFailure(address);
          throw new TRPCError({ code: "UNAUTHORIZED", message: "Email or password is incorrect." });
        }
        clearReaderLoginFailures(address);
        await markReaderLogin(account.id);
        await startReaderSession(account.id, ctx.res);
        return { success: true } as const;
      }),
    logout: publicProcedure.mutation(async ({ ctx }) => {
      await endReaderSession(ctx.req, ctx.res);
      return { success: true } as const;
    }),
  }),
  novels: router({
    list: publicProcedure
      .input(z.object({ query: z.string().max(120).optional(), genre: z.enum(NOVEL_GENRES).optional() }).optional())
      .query(({ input }) => listNovels(input ?? {})),
    details: publicProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .query(({ input, ctx }) => getNovelWithChapters(input.id, ctx.readerAccount?.id)),
  }),
  chapters: router({
    getForReading: publicProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .query(({ input, ctx }) => getReaderChapter(input.id, ctx.readerAccount?.id)),
    unlock: readerProcedure
      .input(z.object({ chapterId: z.number().int().positive() }))
      .mutation(({ input, ctx }) => unlockReaderChapter(ctx.readerAccount.id, input.chapterId)),
  }),
  admin: router({
    status: publicProcedure.query(({ ctx }) => ({ authenticated: ctx.isAdmin, passwordConfigured: (process.env.ADMIN_PASSWORD?.length ?? 0) >= 12 })),
    login: publicProcedure
      .input(z.object({ password: z.string().min(1).max(1024) }))
      .mutation(({ input, ctx }) => {
        if ((process.env.ADMIN_PASSWORD?.length ?? 0) < 12) {
          throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Configure a strong admin password of at least 12 characters." });
        }
        const address = clientAddress(ctx);
        if (isAdminLoginBlocked(address)) {
          throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "Too many sign-in attempts. Try again in 15 minutes." });
        }
        if (!verifyAdminPassword(input.password)) {
          recordFailedAdminLogin(address);
          throw new TRPCError({ code: "UNAUTHORIZED", message: "That password did not match. Try again." });
        }
        clearAdminLoginFailures(address);
        startAdminSession(ctx.res);
        return { success: true } as const;
      }),
    logout: publicProcedure.mutation(({ ctx }) => {
      endAdminSession(ctx.res);
      return { success: true } as const;
    }),
    uploadNovelCover: adminProcedure
      .input(z.object({
        dataBase64: z.string().min(1).max(MAX_NOVEL_COVER_BASE64_CHARS),
        mimeType: z.enum(NOVEL_COVER_MIME_TYPES),
      }))
      .mutation(async ({ input }) => {
        let bytes: Buffer;
        try {
          bytes = decodeNovelCoverPayload(input.dataBase64, input.mimeType);
        } catch (error) {
          throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Invalid cover image." });
        }
        try {
          const stored = await storeNovelCover(bytes, input.mimeType);
          return { url: stored.url };
        } catch {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Cover image could not be saved. Please try again." });
        }
      }),
    createNovel: adminProcedure
      .input(z.object({
        title: z.string().trim().min(1).max(180),
        author: z.string().trim().min(1).max(160),
        genre: z.enum(NOVEL_GENRES),
        coverUrl: novelCoverSource,
        synopsis: z.string().trim().min(1).max(5000),
      }))
      .mutation(({ input }) => createNovel(input)),
    updateNovel: adminProcedure
      .input(z.object({
        id: z.number().int().positive(),
        title: z.string().trim().min(1).max(180),
        author: z.string().trim().min(1).max(160),
        genre: z.enum(NOVEL_GENRES),
        coverUrl: novelCoverSource,
        synopsis: z.string().trim().min(1).max(5000),
      }))
      .mutation(async ({ input }) => {
        const novel = await updateNovel(input);
        if (!novel) throw new TRPCError({ code: "NOT_FOUND", message: "Novel not found." });
        return novel;
      }),
    publishChapter: adminProcedure
      .input(z.object({
        novelId: z.number().int().positive(),
        chapterNumber: z.number().int().positive().max(100000),
        title: z.string().trim().min(1).max(200),
        content: z.string().trim().min(1).max(200000),
        isPaid: z.boolean().default(false),
      }))
      .mutation(async ({ input }) => {
        const chapter = await publishChapter(input);
        if (!chapter) throw new TRPCError({ code: "NOT_FOUND", message: "Novel not found." });
        return chapter;
      }),
    listAccounts: adminProcedure.query(() => listReaderAccounts()),
    createAccount: adminProcedure
      .input(z.object({ email: z.string().trim().email().max(320), password: z.string().min(8).max(128) }))
      .mutation(async ({ input }) => {
        try {
          const passwordHash = await hashReaderPassword(input.password);
          return await createManagedReaderAccount(input.email, passwordHash);
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code === "ER_DUP_ENTRY") {
            throw new TRPCError({ code: "CONFLICT", message: "An account with that email already exists." });
          }
          throw error;
        }
      }),
    topUpCoins: adminProcedure
      .input(z.object({ accountId: z.number().int().positive(), amount: z.number().int().min(1).max(1_000_000) }))
      .mutation(async ({ input }) => {
        try {
          const result = await topUpReaderCoins(input.accountId, input.amount);
          if (!result) throw new TRPCError({ code: "NOT_FOUND", message: "Reader account not found." });
          return result;
        } catch (error) {
          if (error instanceof TRPCError) throw error;
          if (error instanceof Error && error.message.includes("limit would be exceeded")) {
            throw new TRPCError({ code: "BAD_REQUEST", message: error.message });
          }
          throw error;
        }
      }),
    listChapters: adminProcedure
      .input(z.object({ novelId: z.number().int().positive() }))
      .query(({ input }) => listAdminChapters(input.novelId)),
    setChapterPaid: adminProcedure
      .input(z.object({ chapterId: z.number().int().positive(), isPaid: z.boolean() }))
      .mutation(async ({ input }) => {
        const chapter = await setChapterPricing(input.chapterId, input.isPaid);
        if (!chapter) throw new TRPCError({ code: "NOT_FOUND", message: "Chapter not found." });
        return chapter;
      }),
  }),
});

export type AppRouter = typeof appRouter;
