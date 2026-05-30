import { Router, Request, Response } from "express";
import Stripe from "stripe";
import { config } from "../../config/config";
import { handleAmountCapturableUpdated } from "./service";

export const stripeWebhookRouter = Router();
const stripe = new Stripe(config.stripe.secretKey as string);

stripeWebhookRouter.post("/", async (req: Request, res: Response) => {
  const sig = req.headers["stripe-signature"];

  let event: ReturnType<typeof stripe.webhooks.constructEvent>;
  try {
    event = stripe.webhooks.constructEvent(
      req.body as Buffer,
      sig as string,
      config.stripe.webhookSecret as string
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return res.status(400).send(`Webhook Error: ${message}`);
  }

  try {
    if (event.type === "payment_intent.amount_capturable_updated") {
      const paymentIntent = event.data.object;
      await handleAmountCapturableUpdated(paymentIntent.id, event.id);
    }
    return res.status(200).json({ received: true });
  } catch (error) {
    return res.status(500).json({ error: "Webhook handler failed" });
  }
});