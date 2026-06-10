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
  /** Public base URL of the frontend, used to build links sent in emails. */
  appBaseUrl: string;
  /** Password reset settings. */
  passwordReset: {
    /** How long a reset token stays valid, in minutes. */
    tokenTtlMinutes: number;
  };
  resend: {
    /** Resend API key used to send transactional mail. */
    apiKey: string;
    /** Default "from" address for outgoing mail (must be a verified sender). */
    fromAddress: string;
  };
}

export const config: Config = {
  nodeEnv: (process.env["NODE_ENV"] as Config["nodeEnv"]) ?? "development",
  port: process.env["PORT"] ? Number(process.env["PORT"]) : 8000,
  mongoUri:
    process.env["MONGO_URI"] ??
    "mongodb://localhost:27017/lineless?directConnection=true",
  jwt: {
    secret:
      process.env["JWT_SECRET"] ??
      "REPLACE_WITH_A_RANDOM_64_CHAR_HEX_JWT_SECRET",
    algorithm: "HS256",
    expiresIn: process.env["JWT_EXPIRES_IN"] ?? "30d",
    operatorExpiresIn: process.env["JWT_OPERATOR_EXPIRES_IN"] ?? "12h",
  },
  bcryptRounds: 10,
  appBaseUrl: process.env["APP_BASE_URL"] ?? "http://localhost:3000",
  passwordReset: {
    tokenTtlMinutes: 60,
  },
  resend: {
    apiKey:
      process.env["RESEND_API_KEY"] ?? "re_REPLACE_WITH_YOUR_RESEND_API_KEY",
    fromAddress: process.env["RESEND_FROM_ADDRESS"] ?? "contact@lineless.shop",
  },
};
