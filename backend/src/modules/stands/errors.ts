export class StandNotFoundError extends Error {
  constructor() {
    super("Stand not found");
    this.name = "StandNotFoundError";
  }
}
