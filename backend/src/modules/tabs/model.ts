import { model, Schema } from "mongoose";
import { v4 as uuidv4 } from "uuid";

const TabSchema = new Schema({
  _id: { type: String, default: uuidv4 },
  userId: { type: String, required: true, index: true },
  status: {
    type: String,
    enum: ["PENDING_AUTHORIZATION", "OPEN", "CHECKOUT_PENDING", "PAID", "FAILED"],
    default: "OPEN",
  },
}, { timestamps: true });

export const Tab = model("Tab", TabSchema);