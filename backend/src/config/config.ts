interface Config {
  nodeEnv: "development" | "production" | "test";
  port: number;
  mongoUri: string;
  jwt: {
    secret: string;
    /** Token lifetime for organizer (Account) JWTs. */
    expiresIn: string;
  };
  /** Name of the httpOnly cookie holding the attendee userSessionId. */
  sessionCookieName: string;
  /** bcrypt cost factor used for all password hashing. */
  bcryptRounds: number;

  /** Add Stripe type definitions */
    stripe: {
      secretKey: string;
      webhookSecret: string;
    };
}

export const config: Config = {
  nodeEnv: "development",
  port: process.env["PORT"] ? Number(process.env["PORT"]) : 8000,
  mongoUri:
    process.env["MONGO_URI"] ??
    "mongodb://localhost:27017/lineless?directConnection=true",
  jwt: {
    secret: "dev-demo-secret-not-for-production",
    expiresIn: "7d",
  },
  sessionCookieName: "userSessionId",
  bcryptRounds: 10,
  stripe: {
    secretKey: "sk_test_REPLACE_WITH_YOUR_STRIPE_TEST_SECRET_KEY",
    webhookSecret: "whsec_REPLACE_WITH_YOUR_STRIPE_WEBHOOK_SECRET",
  }
};
