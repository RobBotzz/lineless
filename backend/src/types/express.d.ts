import "express";

declare global {
  namespace Express {
    interface Request {
      account?: {
        accountId: string;
      };
      operator?: {
        standId: string;
      };
      attendee?: {
        sessionId: string;
      };
      user?: {
        accountId: string;
      };
      stand?: {
        standId: string;
        eventId?: string;
      };
    }
  }
}
