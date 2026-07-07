import {
  verifyEventOwnership,
  verifyMutableEventOwnership,
} from "../events/ownership";
import { Stand } from "../stands/model";
import { EventControlCenterSettings as EventControlCenterSettingsModel } from "./settings.model";
import {
  DEFAULT_AVERAGE_WAIT_ALERT_THRESHOLD_MINUTES,
  DEFAULT_QUEUE_LENGTH_ALERT_THRESHOLD,
  DEFAULT_STOCK_ALERT_THRESHOLD,
  type EventControlCenterSettings,
  type StandAlertThreshold,
} from "./types";

export class InvalidEventControlCenterSettingsError extends Error {
  constructor() {
    super("Threshold settings contain a stand outside this event.");
  }
}

function defaultStandThreshold(): StandAlertThreshold {
  return {
    queueLengthAlertThreshold: DEFAULT_QUEUE_LENGTH_ALERT_THRESHOLD,
    averageWaitAlertThresholdMinutes:
      DEFAULT_AVERAGE_WAIT_ALERT_THRESHOLD_MINUTES,
  };
}

function materializeSettings(
  standIds: string[],
  stored?: {
    stockAlertThreshold: number;
    standAlertThresholds: Array<{
      standId: string;
      queueLengthAlertThreshold: number;
      averageWaitAlertThresholdMinutes: number;
    }>;
  } | null
): EventControlCenterSettings {
  const storedByStandId = new Map(
    stored?.standAlertThresholds.map((threshold) => [
      threshold.standId,
      {
        queueLengthAlertThreshold: threshold.queueLengthAlertThreshold,
        averageWaitAlertThresholdMinutes:
          threshold.averageWaitAlertThresholdMinutes,
      },
    ]) ?? []
  );

  return {
    stockAlertThreshold:
      stored?.stockAlertThreshold ?? DEFAULT_STOCK_ALERT_THRESHOLD,
    standAlertThresholds: Object.fromEntries(
      standIds.map((standId) => [
        standId,
        storedByStandId.get(standId) ?? defaultStandThreshold(),
      ])
    ),
  };
}

async function loadCurrentStandIds(eventId: string): Promise<string[]> {
  const stands = await Stand.find({ eventId, deletedAt: null })
    .select("_id")
    .lean<Array<{ _id: string }>>();
  return stands.map((stand) => stand._id);
}

export async function loadEffectiveEventControlCenterSettings(
  eventId: string,
  standIds: string[]
): Promise<EventControlCenterSettings> {
  const stored = await EventControlCenterSettingsModel.findById(eventId).lean();
  return materializeSettings(standIds, stored);
}

export async function getEventControlCenterSettings(
  eventId: string,
  accountId: string
): Promise<EventControlCenterSettings> {
  await verifyEventOwnership(eventId, accountId);
  const standIds = await loadCurrentStandIds(eventId);
  return loadEffectiveEventControlCenterSettings(eventId, standIds);
}

export async function replaceEventControlCenterSettings(
  eventId: string,
  accountId: string,
  settings: EventControlCenterSettings
): Promise<EventControlCenterSettings> {
  await verifyMutableEventOwnership(eventId, accountId);
  const standIds = await loadCurrentStandIds(eventId);
  const currentStandIds = new Set(standIds);

  if (
    Object.keys(settings.standAlertThresholds).some(
      (standId) => !currentStandIds.has(standId)
    )
  ) {
    throw new InvalidEventControlCenterSettingsError();
  }

  const canonical = materializeSettings(standIds, {
    stockAlertThreshold: settings.stockAlertThreshold,
    standAlertThresholds: standIds.map((standId) => ({
      standId,
      ...(settings.standAlertThresholds[standId] ?? defaultStandThreshold()),
    })),
  });

  await EventControlCenterSettingsModel.findByIdAndUpdate(
    eventId,
    {
      $set: {
        stockAlertThreshold: canonical.stockAlertThreshold,
        standAlertThresholds: standIds.map((standId) => ({
          standId,
          ...canonical.standAlertThresholds[standId],
        })),
      },
    },
    {
      returnDocument: "after",
      runValidators: true,
      setDefaultsOnInsert: true,
      upsert: true,
    }
  );

  return canonical;
}

export async function resetEventControlCenterSettings(
  eventId: string,
  accountId: string
): Promise<EventControlCenterSettings> {
  await verifyMutableEventOwnership(eventId, accountId);
  const standIds = await loadCurrentStandIds(eventId);
  await EventControlCenterSettingsModel.findByIdAndDelete(eventId);
  return materializeSettings(standIds);
}
