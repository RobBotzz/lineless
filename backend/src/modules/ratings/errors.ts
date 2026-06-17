export class AlreadyReviewedError extends Error {
  constructor() {
    super("This product has already been reviewed for this order");
    this.name = "AlreadyReviewedError";
  }
}

export class NotEligibleForReviewError extends Error {
  constructor() {
    super("This product has not been fulfilled in this order");
    this.name = "NotEligibleForReviewError";
  }
}

export class RatingsDisabledError extends Error {
  constructor() {
    super("Ratings are not enabled for this event");
    this.name = "RatingsDisabledError";
  }
}
