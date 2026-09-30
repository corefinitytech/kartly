import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { hash, verify } from "@node-rs/argon2";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { hashIp } from "@/lib/audit";
import { sendMail } from "@/lib/mailer";
import { accounts, sessions, users, verifications } from "@/db/schema/identity";
import { passwordChangedEmail, passwordResetEmail, verifyEmailEmail } from "@/modules/auth/emails";

const argonOptions = {
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
  algorithm: 2,
};

async function hashPassword(password: string): Promise<string> {
  return hash(password, argonOptions);
}

async function verifyPassword(data: { password: string; hash: string }): Promise<boolean> {
  return verify(data.hash, data.password, argonOptions);
}

export const auth = betterAuth({
  baseURL: env.APP_URL,
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: [env.APP_URL],
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: users,
      session: sessions,
      account: accounts,
      verification: verifications,
    },
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    minPasswordLength: 10,
    maxPasswordLength: 128,
    password: {
      hash: hashPassword,
      verify: verifyPassword,
    },
    sendResetPassword: async ({ user, token }) => {
      const url = `${env.APP_URL}/reset-password?token=${token}`;
      const mail = passwordResetEmail(user.name, url);
      await sendMail({ to: user.email, ...mail });
    },
  },
  emailVerification: {
    sendVerificationEmail: async ({ user, token }) => {
      const url = `${env.APP_URL}/verify-email?token=${token}`;
      const mail = verifyEmailEmail(user.name, url);
      await sendMail({ to: user.email, ...mail });
    },
    expiresIn: 60 * 60 * 24,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
    cookieCache: {
      enabled: false,
    },
  },
  advanced: {
    useCookiePrefix: true,
    defaultCookieAttributes: {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
    },
  },
  user: {
    additionalFields: {
      role: { type: "string", defaultValue: "customer", input: false },
      status: { type: "string", defaultValue: "active", input: false },
      locale: { type: "string", defaultValue: "en", input: false },
    },
  },
  databaseHooks: {
    session: {
      create: {
        before: async (session) => {
          if (session.ipAddress) {
            return { data: { ...session, ipAddress: hashIp(session.ipAddress) } };
          }
          return { data: session };
        },
      },
    },
  },
});

export { hashPassword, verifyPassword, passwordChangedEmail };
