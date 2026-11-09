import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { config } from "@/lib/config";
import { db } from "@/lib/db";
import { staffRoleFor } from "@/lib/staff-access";

const NOT_ALLOWED = "This account doesn't have access to the NeoRegen portal. Ask an admin to add you.";

async function assertStaff(email: string) {
  if (!(await staffRoleFor(email))) throw new APIError("FORBIDDEN", { message: NOT_ALLOWED });
}

const google =
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
    ? {
        google: {
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          prompt: "select_account" as const,
        },
      }
    : undefined;

export const auth = betterAuth({
  database: prismaAdapter(db, { provider: "postgresql" }),
  socialProviders: google,
  emailAndPassword: { enabled: config.devLoginEnabled },
  // Only staff on the list get an account or a session. Pages and actions
  // check again on every request, so removing someone takes effect at once.
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          await assertStaff(user.email);
          return { data: user };
        },
      },
    },
    session: {
      create: {
        before: async (session) => {
          const user = await db.user.findUnique({ where: { id: session.userId } });
          if (!user) throw new APIError("FORBIDDEN", { message: NOT_ALLOWED });
          await assertStaff(user.email);
          return { data: session };
        },
      },
    },
  },
  plugins: [nextCookies()],
});
