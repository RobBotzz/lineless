import mongoose from "mongoose";
import { config } from "../config/config";

export async function connectDB(): Promise<void> {
  await mongoose.connect(config.mongoUri);
  console.log("MongoDB verbunden");
}

export async function disconnectDB(): Promise<void> {
  await mongoose.disconnect();
}
