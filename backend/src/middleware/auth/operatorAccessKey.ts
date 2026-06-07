import type { Request } from "express";
import { verifyOperatorAccessKey } from "../../modules/events/ownership";

const OPERATOR_ACCESS_KEY_HEADER = "X-Operator-Access-Key";

export async function authenticateOperatorAccessKeyRequest(
  req: Request
): Promise<{ eventId: string }> {
  const key = req.get(OPERATOR_ACCESS_KEY_HEADER);
  if (!key) {
    throw new Error("No operator access key found");
  }

  const eventId = req.params["eventId"];
  if (typeof eventId !== "string" || eventId.length === 0) {
    throw new Error("Missing event id");
  }

  await verifyOperatorAccessKey(eventId, key);
  return { eventId };
}
