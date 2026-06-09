import { Resend } from "resend";
import { config } from "../../config/config";

// Single shared Resend client, keyed off the committed config API key.
export const resend = new Resend(config.resend.apiKey);
