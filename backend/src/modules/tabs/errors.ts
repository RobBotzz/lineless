export class TabNotFoundError extends Error {
  constructor(message = "Tab not found") {
    super(message);
    this.name = "TabNotFoundError";
  }
}

export class TabStateError extends Error {
  constructor(message = "Invalid tab state for this operation") {
    super(message);
    this.name = "TabStateError";
  }
}