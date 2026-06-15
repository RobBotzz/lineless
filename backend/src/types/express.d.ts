import "express";

declare global {
  namespace Express {
    interface Request {
      eventId: string;
      orderId: string;
      standId: string;
      productId: string;
      accountId: string;
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
