import "express";

declare global {
  namespace Express {
    interface Request {
      organizer?: {
        accountId: string;
      };
      operator?: {
        standId: string;
      };
      operatorLink?: {
        eventId: string;
      };
      attendee?: {
        sessionId: string;
        eventId: string;
      };
    }
  }
}
