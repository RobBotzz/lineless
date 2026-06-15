import type { EventControlCenterSettings } from '@/api/eventControlCenter';

export const defaultControlCenterSettings: EventControlCenterSettings = {
  queueLengthAlertThreshold: 10,
  averageWaitAlertThresholdMinutes: 15,
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
  settings: Partial<EventControlCenterSettings>,
): EventControlCenterSettings {
  return {
    queueLengthAlertThreshold: normalizeThreshold(
      settings.queueLengthAlertThreshold,
      defaultControlCenterSettings.queueLengthAlertThreshold,
    ),
    averageWaitAlertThresholdMinutes: normalizeThreshold(
      settings.averageWaitAlertThresholdMinutes,
      defaultControlCenterSettings.averageWaitAlertThresholdMinutes,
    ),
  };
}

function normalizeThreshold(value: unknown, fallback: number): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(0, Math.round(numeric));
}
