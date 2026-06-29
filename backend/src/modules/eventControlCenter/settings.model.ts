import { model, Schema } from "mongoose";
import {
  DEFAULT_AVERAGE_WAIT_ALERT_THRESHOLD_MINUTES,
  DEFAULT_QUEUE_LENGTH_ALERT_THRESHOLD,
  DEFAULT_STOCK_ALERT_THRESHOLD,
} from "./types";

export interface StoredStandAlertThreshold {
  standId: string;
  queueLengthAlertThreshold: number;
  averageWaitAlertThresholdMinutes: number;
}

export interface EventControlCenterSettingsDoc {
  _id: string;
  stockAlertThreshold: number;
  standAlertThresholds: StoredStandAlertThreshold[];
  createdAt: Date;
  updatedAt: Date;
}

const integerThreshold = {
  type: Number,
  required: true,
  min: 0,
  validate: Number.isInteger,
};

const standAlertThresholdSchema = new Schema<StoredStandAlertThreshold>(
  {
    standId: { type: String, required: true },
    queueLengthAlertThreshold: {
      ...integerThreshold,
      default: DEFAULT_QUEUE_LENGTH_ALERT_THRESHOLD,
    },
    averageWaitAlertThresholdMinutes: {
      ...integerThreshold,
      default: DEFAULT_AVERAGE_WAIT_ALERT_THRESHOLD_MINUTES,
    },
  },
  { _id: false }
);

const eventControlCenterSettingsSchema =
  new Schema<EventControlCenterSettingsDoc>(
    {
      _id: { type: String, required: true },
      stockAlertThreshold: {
        ...integerThreshold,
        default: DEFAULT_STOCK_ALERT_THRESHOLD,
      },
      standAlertThresholds: {
        type: [standAlertThresholdSchema],
        default: [],
      },
    },
    { timestamps: true }
  );

export const EventControlCenterSettings = model<EventControlCenterSettingsDoc>(
  "EventControlCenterSettings",
  eventControlCenterSettingsSchema
);
