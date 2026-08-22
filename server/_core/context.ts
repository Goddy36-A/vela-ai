import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";
import * as db from "../db";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

// ── Guest platform user ────────────────────────────────────────────────
// When no OAuth session is present we upsert this user once and reuse it,
// so every protectedProcedure works without requiring a login flow.
const GUEST_OPEN_ID = "guest_velaai_platform";

async function getOrCreateGuestUser(): Promise<User | null> {
  try {
    await db.upsertUser({
      openId:      GUEST_OPEN_ID,
      name:        "Godfrey Atwijukire",
      email:       "admin@velaai.platform",
      loginMethod: "platform",
      role:        "admin",
      lastSignedIn: new Date(),
    });
    return await db.getUserByOpenId(GUEST_OPEN_ID);
  } catch (err) {
    console.warn("[Auth] Guest user upsert failed (DB unavailable?):", err);
    return null;
  }
}

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch {
    // No valid OAuth session — fall back to the built-in platform user.
    user = await getOrCreateGuestUser();
  }

  return { req: opts.req, res: opts.res, user };
}
