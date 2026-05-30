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
}

export const config: Config = {
  nodeEnv: "development",
  port: process.env["PORT"] ? Number(process.env["PORT"]) : 8000,
  mongoUri: process.env["MONGO_URI"] ?? "mongodb://localhost:27017/lineless",
  jwt: {
    secret: "REPLACE_WITH_A_RANDOM_64_CHAR_HEX_JWT_SECRET",
    expiresIn: "30d",
  },
  sessionCookieName: "userSessionId",
  bcryptRounds: 10,
};
