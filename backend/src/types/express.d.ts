import "express";

// Attached by the authAccount middleware after verifying the organizer JWT.
declare global {
  namespace Express {
    interface Request {
      user?: {
        accountId: string;
      };
    }
  }
}
