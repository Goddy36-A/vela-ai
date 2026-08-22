import { NOT_ADMIN_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";
import type { User } from "../../drizzle/schema";

const t = initTRPC.context<TrpcContext>().create({ transformer: superjson });

export const router         = t.router;
export const publicProcedure = t.procedure;

// ── Platform guest — used when no OAuth session is present ─────────────
// This means every protectedProcedure works without any login flow.
// Tasks are stored under userId=1 in the DB (or in-memory when no DB).
const PLATFORM_GUEST: User = {
  id:           1,
  openId:       "guest_velaai_platform",
  name:         "Godfrey Atwijukire",
  email:        "admin@velaai.platform",
  loginMethod:  "platform",
  role:         "admin",
  createdAt:    new Date(),
  updatedAt:    new Date(),
  lastSignedIn: new Date(),
};

// Never throws — falls back to PLATFORM_GUEST when ctx.user is null.
const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;
  return next({ ctx: { ...ctx, user: ctx.user ?? PLATFORM_GUEST } });
});

export const protectedProcedure = t.procedure.use(requireUser);

export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;
    const user = ctx.user ?? PLATFORM_GUEST;
    if (user.role !== 'admin') {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }
    return next({ ctx: { ...ctx, user } });
  })
);
