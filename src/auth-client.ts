import { betterAuth } from "better-auth";
import { Pool } from "pg";

function getTrustedOrigins() {
  const origins = new Set(["http://localhost:3000"]);

  if (process.env.BETTER_AUTH_URL) {
    origins.add(process.env.BETTER_AUTH_URL);
  }

  for (const origin of process.env.BETTER_AUTH_TRUSTED_ORIGINS?.split(",") ??
    []) {
    const trimmed = origin.trim();
    if (trimmed) origins.add(trimmed);
  }

  return [...origins];
}

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  database: new Pool({
    connectionString: process.env.DATABASE_URL,
  }),
  trustedOrigins: getTrustedOrigins(),
  emailAndPassword: {
    enabled: true,
  },
  socialProviders: {
    twitter: {
      clientId: process.env.TWITTER_CLIENT ?? "",
      clientSecret: process.env.TWITTER_SECRET ?? "",
    },
  },
});
