import type { Algorithm } from "jsonwebtoken";

interface Config {
  nodeEnv: "development" | "production" | "test";
  port: number;
  mongoUri: string;
  jwt: {
    secret: string;
    /** JWT signing and verification algorithm. */
    algorithm: Algorithm;
    /** Token lifetime for organizer JWTs. */
    expiresIn: string;
    /** Token lifetime for operator (stand) JWTs. */
    operatorExpiresIn: string;
  };
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
    secret: "REPLACE_WITH_A_RANDOM_64_CHAR_HEX_JWT_SECRET",
    algorithm: "HS256",
    expiresIn: "30d",
    operatorExpiresIn: "12h",
  },
  bcryptRounds: 10,
  stripe: {
    secretKey:
      "sk_test_REPLACE_WITH_YOUR_STRIPE_TEST_SECRET_KEY",
    webhookSecret:
      "whsec_REPLACE_WITH_YOUR_STRIPE_WEBHOOK_SECRET",
  },
};
