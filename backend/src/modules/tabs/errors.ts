export class TabNotFoundError extends Error {
  constructor() {
    super("Tab not found");
    this.name = "TabNotFoundError";
  }
}

export class TabStateError extends Error {
  constructor(message = "Invalid tab state for this operation") {
    super(message);
    this.name = "TabStateError";
  }
}
