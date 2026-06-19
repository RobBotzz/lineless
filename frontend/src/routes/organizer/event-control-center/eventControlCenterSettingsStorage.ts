import type { EventControlCenterSettings, StandAlertThreshold } from '@/api/eventControlCenter';
import type { Stand } from '@/types/stand';

export const defaultStandControlCenterThresholds: StandAlertThreshold = {
  queueLengthAlertThreshold: 10,
  averageWaitAlertThresholdMinutes: 15,
};

export const defaultStockAlertThreshold = 5;

export const defaultControlCenterSettings: EventControlCenterSettings = {
  standAlertThresholds: {},
  stockAlertThreshold: defaultStockAlertThreshold,
};

function controlCenterSettingsKey(eventId: string): string {
  return `lineless.event-control-center.${eventId}.settings`;
}

export function readControlCenterSettings(eventId: string): EventControlCenterSettings {
  if (typeof window === 'undefined') return defaultControlCenterSettings;

  try {
    const raw = window.localStorage.getItem(controlCenterSettingsKey(eventId));
    if (!raw) return defaultControlCenterSettings;
    const parsed = JSON.parse(raw) as Partial<EventControlCenterSettings>;
    return normalizeControlCenterSettings(parsed);
  } catch {
    return defaultControlCenterSettings;
  }
}

export function writeControlCenterSettings(eventId: string, settings: EventControlCenterSettings) {
  window.localStorage.setItem(controlCenterSettingsKey(eventId), JSON.stringify(settings));
}

export function normalizeControlCenterSettings(
  settings: Partial<EventControlCenterSettings> & {
    queueLengthAlertThreshold?: unknown;
    averageWaitAlertThresholdMinutes?: unknown;
    stockAlertThreshold?: unknown;
  },
): EventControlCenterSettings {
  const legacyQueueLengthThreshold = settings.queueLengthAlertThreshold;
  const legacyAverageWaitThreshold = settings.averageWaitAlertThresholdMinutes;
  const standAlertThresholds: Record<string, StandAlertThreshold> = {};
  const rawStandThresholds = settings.standAlertThresholds;

  if (rawStandThresholds && typeof rawStandThresholds === 'object') {
    for (const [standId, thresholds] of Object.entries(rawStandThresholds)) {
      standAlertThresholds[standId] = normalizeStandAlertThreshold(thresholds);
    }
  }

  return {
    stockAlertThreshold: normalizeThreshold(
      settings.stockAlertThreshold,
      defaultStockAlertThreshold,
    ),
    standAlertThresholds:
      Object.keys(standAlertThresholds).length > 0
        ? standAlertThresholds
        : legacyQueueLengthThreshold !== undefined || legacyAverageWaitThreshold !== undefined
          ? {
              legacy: {
                queueLengthAlertThreshold: normalizeThreshold(
                  legacyQueueLengthThreshold,
                  defaultStandControlCenterThresholds.queueLengthAlertThreshold,
                ),
                averageWaitAlertThresholdMinutes: normalizeThreshold(
                  legacyAverageWaitThreshold,
                  defaultStandControlCenterThresholds.averageWaitAlertThresholdMinutes,
                ),
              },
            }
          : {},
  };
}

export function createSettingsForStands(
  settings: EventControlCenterSettings,
  stands: Pick<Stand, '_id'>[],
): EventControlCenterSettings {
  const legacyThresholds = settings.standAlertThresholds.legacy;
  const standAlertThresholds: Record<string, StandAlertThreshold> = {};

  for (const stand of stands) {
    standAlertThresholds[stand._id] =
      settings.standAlertThresholds[stand._id] ??
      legacyThresholds ??
      defaultStandControlCenterThresholds;
  }

  return {
    standAlertThresholds,
    stockAlertThreshold: normalizeThreshold(
      settings.stockAlertThreshold,
      defaultStockAlertThreshold,
    ),
  };
}

function normalizeStandAlertThreshold(value: unknown): StandAlertThreshold {
  const thresholds = value as Partial<StandAlertThreshold> | null | undefined;
  return {
    queueLengthAlertThreshold: normalizeThreshold(
      thresholds?.queueLengthAlertThreshold,
      defaultStandControlCenterThresholds.queueLengthAlertThreshold,
    ),
    averageWaitAlertThresholdMinutes: normalizeThreshold(
      thresholds?.averageWaitAlertThresholdMinutes,
      defaultStandControlCenterThresholds.averageWaitAlertThresholdMinutes,
    ),
  };
}

function normalizeThreshold(value: unknown, fallback: number): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(0, Math.round(numeric));
}
