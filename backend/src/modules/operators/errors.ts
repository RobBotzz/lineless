export class OperatorInvalidCredentialsError extends Error {
  constructor() {
    super("Invalid stand credentials");
    this.name = "OperatorInvalidCredentialsError";
  }
}
