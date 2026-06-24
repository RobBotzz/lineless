import type { EventControlCenterSettings, StandAlertThreshold } from '@/api/eventControlCenter';
import { readJsonFromStorage, writeJsonToStorage } from '@/lib/browserStorage';
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
  const parsed = readJsonFromStorage(controlCenterSettingsKey(eventId));
  return parsed === null ? defaultControlCenterSettings : normalizeControlCenterSettings(parsed);
}

export function writeControlCenterSettings(eventId: string, settings: EventControlCenterSettings) {
  writeJsonToStorage(controlCenterSettingsKey(eventId), settings);
}

export function createControlCenterSettingsSignature(settings: EventControlCenterSettings): string {
  return JSON.stringify({
    stockAlertThreshold: normalizeThreshold(
      settings.stockAlertThreshold,
      defaultStockAlertThreshold,
    ),
    standAlertThresholds: Object.fromEntries(
      Object.entries(settings.standAlertThresholds)
        .sort(([leftStandId], [rightStandId]) => leftStandId.localeCompare(rightStandId))
        .map(([standId, thresholds]) => [
          standId,
          {
            queueLengthAlertThreshold: normalizeThreshold(
              thresholds.queueLengthAlertThreshold,
              defaultStandControlCenterThresholds.queueLengthAlertThreshold,
            ),
            averageWaitAlertThresholdMinutes: normalizeThreshold(
              thresholds.averageWaitAlertThresholdMinutes,
              defaultStandControlCenterThresholds.averageWaitAlertThresholdMinutes,
            ),
          },
        ]),
    ),
  });
}

export function normalizeControlCenterSettings(settings: unknown): EventControlCenterSettings {
  const standAlertThresholds: Record<string, StandAlertThreshold> = {};
  const rawSettings = isRecord(settings) ? settings : {};
  const rawStandThresholds = rawSettings.standAlertThresholds;

  if (rawStandThresholds && typeof rawStandThresholds === 'object') {
    for (const [standId, thresholds] of Object.entries(rawStandThresholds)) {
      standAlertThresholds[standId] = normalizeStandAlertThreshold(thresholds);
    }
  }

  return {
    stockAlertThreshold: normalizeThreshold(
      rawSettings.stockAlertThreshold,
      defaultStockAlertThreshold,
    ),
    standAlertThresholds,
  };
}

export function createSettingsForStands(
  settings: EventControlCenterSettings,
  stands: Pick<Stand, '_id'>[],
): EventControlCenterSettings {
  const standAlertThresholds: Record<string, StandAlertThreshold> = {};

  for (const stand of stands) {
    standAlertThresholds[stand._id] =
      settings.standAlertThresholds[stand._id] ?? defaultStandControlCenterThresholds;
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
