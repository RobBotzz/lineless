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
  port: 3000,
  mongoUri: "mongodb://localhost:27017/lineless",
  jwt: {
    secret: "dev-demo-secret-not-for-production",
    expiresIn: "7d",
  },
  sessionCookieName: "userSessionId",
  bcryptRounds: 10,
};
