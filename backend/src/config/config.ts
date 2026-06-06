interface Config {
  nodeEnv: "development" | "production" | "test";
  port: number;
  mongoUri: string;
  jwt: {
    secret: string;
    /** Token lifetime for organizer JWTs. */
    expiresIn: string;
  };
  /** bcrypt cost factor used for all password hashing. */
  bcryptRounds: number;
}

export const config: Config = {
  nodeEnv: "development",
  port: process.env["PORT"] ? Number(process.env["PORT"]) : 8000,
  mongoUri:
    process.env["MONGO_URI"] ??
    "mongodb://localhost:27017/lineless?directConnection=true",
  jwt: {
    secret: "REPLACE_WITH_A_RANDOM_64_CHAR_HEX_JWT_SECRET",
    expiresIn: "30d",
  },
  bcryptRounds: 10,
};
