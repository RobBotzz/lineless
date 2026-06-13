export class RefreshTokenInvalidError extends Error {
  constructor() {
    super("Invalid or expired refresh token");
    this.name = "RefreshTokenInvalidError";
  }
}
