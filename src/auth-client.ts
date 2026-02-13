import { betterAuth } from "better-auth";
import { Pool } from "pg";

export const auth = betterAuth({
  database: new Pool({
    connectionString: process.env.DATABASE_URL,
  }),
  trustedOrigins: ["http://localhost:3000"],
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
