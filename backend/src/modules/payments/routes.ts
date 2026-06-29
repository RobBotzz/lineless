import { Router, Request, Response } from "express";
import Stripe from "stripe";
import { config } from "../../config/config";
import { handleAmountCapturableUpdated, handlePaymentFailed } from "./service";

const stripeWebhookRouter = Router();
const stripe = new Stripe(config.stripe.secretKey);

stripeWebhookRouter.post("/", async (req: Request, res: Response) => {
  const sig = req.headers["stripe-signature"];
  const allowUnsigned = config.stripe.allowUnsignedWebhooks;

  let event: ReturnType<typeof stripe.webhooks.constructEvent>;
  try {
    if (
      allowUnsigned &&
      (!sig || sig === "REPLACE_WITH_STRIPE_CLI_SIGNATURE")
    ) {
      // Flag explicitly enabled: accept an unsigned event (e.g. Bruno) without
      // verification. The body is the raw Buffer, so parse it into the event
      // object here.
      event = JSON.parse((req.body as Buffer).toString("utf8")) as ReturnType<
        typeof stripe.webhooks.constructEvent
      >;
    } else {
      if (!sig) {
        return res
          .status(400)
          .send("Webhook Error: Missing Stripe-Signature header");
      }

      event = stripe.webhooks.constructEvent(
        req.body as Buffer,
        sig,
        config.stripe.webhookSecret
      );
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return res.status(400).send(`Webhook Error: ${message}`);
  }

  try {
    if (event.type === "payment_intent.amount_capturable_updated") {
      await handleAmountCapturableUpdated(event.data.object.id, event.id);
    } else if (event.type === "payment_intent.payment_failed") {
      await handlePaymentFailed(event.data.object.id, event.id);
    }
    return res.status(200).json({ received: true });
  } catch {
    return res.status(500).json({ error: "Webhook handler failed" });
  }
});

export default stripeWebhookRouter;
