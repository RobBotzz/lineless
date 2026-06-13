import type { Algorithm } from "jsonwebtoken";

interface Config {
  nodeEnv: "development" | "production" | "test";
  port: number;
  mongoUri: string;
  auth: {
    jwt: {
      secret: string;
      algorithm: Algorithm;
    };
    bcryptRounds: number;
    organizer: {
      accessTokenExpiresIn: string;
      refreshTokenTtlDays: number;
      passwordResetTtlMinutes: number;
    };
    operator: {
      accessTokenExpiresIn: string;
      refreshTokenTtlDays: number;
    };
  };
  /** Public base URL of the frontend, used to build links sent in emails. */
  appBaseUrl: string;
  resend: {
    /** Resend API key used to send transactional mail. */
    apiKey: string;
    /** Default "from" address for outgoing mail (must be a verified sender). */
    fromAddress: string;
  };
  stripe: {
    secretKey: string;
    webhookSecret: string;
  };
}

export const config: Config = {
  nodeEnv: (process.env["NODE_ENV"] as Config["nodeEnv"]) ?? "development",
  port: process.env["PORT"] ? Number(process.env["PORT"]) : 8000,
  mongoUri:
    process.env["MONGO_URI"] ??
    "mongodb://localhost:27017/lineless?directConnection=true",
  auth: {
    jwt: {
      secret:
        process.env["JWT_SECRET"] ??
        "REPLACE_WITH_A_RANDOM_64_CHAR_HEX_JWT_SECRET",
      algorithm: "HS256",
    },
    bcryptRounds: process.env["BCRYPT_ROUNDS"]
      ? Number(process.env["BCRYPT_ROUNDS"])
      : 10,
    organizer: {
      accessTokenExpiresIn: process.env["JWT_EXPIRES_IN"] ?? "5m",
      refreshTokenTtlDays: process.env["REFRESH_TOKEN_TTL_DAYS"]
        ? Number(process.env["REFRESH_TOKEN_TTL_DAYS"])
        : 30,
      passwordResetTtlMinutes: process.env["PASSWORD_RESET_TTL_MINUTES"]
        ? Number(process.env["PASSWORD_RESET_TTL_MINUTES"])
        : 60,
    },
    operator: {
      accessTokenExpiresIn: process.env["JWT_OPERATOR_EXPIRES_IN"] ?? "5m",
      refreshTokenTtlDays: process.env["OPERATOR_REFRESH_TOKEN_TTL_DAYS"]
        ? Number(process.env["OPERATOR_REFRESH_TOKEN_TTL_DAYS"])
        : 7,
    },
  },
  appBaseUrl: process.env["APP_BASE_URL"] ?? "http://localhost:3000",
  resend: {
    apiKey:
      process.env["RESEND_API_KEY"] ?? "re_REPLACE_WITH_YOUR_RESEND_API_KEY",
    fromAddress: process.env["RESEND_FROM_ADDRESS"] ?? "contact@lineless.shop",
  },
  stripe: {
    secretKey:
      "sk_test_REPLACE_WITH_YOUR_STRIPE_TEST_SECRET_KEY",
    webhookSecret:
      "whsec_REPLACE_WITH_YOUR_STRIPE_WEBHOOK_SECRET",
  },
};
