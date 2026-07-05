import { useMemo, useState } from 'react';

import {
  resetEventControlCenterSettings,
  updateEventControlCenterSettings,
  type EventControlCenterSettings,
} from '@/api/eventControlCenter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TextField } from '@/components/ui/text-field';
import {
  createSettingsForStands,
  createControlCenterSettingsSignature,
  defaultStockAlertThreshold,
  defaultStandControlCenterThresholds,
  normalizeControlCenterSettings,
} from './eventControlCenterSettings';
import type { Stand } from '@/types/stand';

export function EventControlCenterSettingsPage({
  eventId,
  settings,
  stands,
}: {
  eventId: string;
  settings: EventControlCenterSettings;
  stands: Stand[];
}) {
  const normalizedSettings = useMemo(
    () => createSettingsForStands(settings, stands),
    [settings, stands],
  );
  const sourceSettingsSignature = useMemo(
    () => createControlCenterSettingsSignature(settings),
    [settings],
  );
  const [formState, setFormState] = useState(() => ({
    form: normalizedSettings,
    saved: normalizedSettings,
    sourceSignature: sourceSettingsSignature,
  }));
  const [savedMessage, setSavedMessage] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [requestState, setRequestState] = useState<'idle' | 'resetting' | 'saving'>('idle');
  let form = formState.form;
  let saved = formState.saved;
  if (formState.sourceSignature !== sourceSettingsSignature) {
    form = normalizedSettings;
    saved = normalizedSettings;
    setFormState({ form, saved, sourceSignature: sourceSettingsSignature });
  }
  const hasChanges = !controlCenterSettingsEqual(form, saved);
  const isSubmitting = requestState !== 'idle';

  function updateStandThreshold(
    standId: string,
    key: keyof EventControlCenterSettings['standAlertThresholds'][string],
    value: number,
  ) {
    setSavedMessage(null);
    setRequestError(null);
    setFormState((current) => ({
      ...current,
      form: {
        ...current.form,
        standAlertThresholds: {
          ...current.form.standAlertThresholds,
          [standId]: {
            ...(current.form.standAlertThresholds[standId] ?? defaultStandControlCenterThresholds),
            [key]: value,
          },
        },
      },
    }));
  }

  function updateStockAlertThreshold(value: number) {
    setSavedMessage(null);
    setRequestError(null);
    setFormState((current) => ({
      ...current,
      form: {
        ...current.form,
        stockAlertThreshold: value,
      },
    }));
  }

  async function saveSettings() {
    const nextSettings = createSettingsForStands(normalizeControlCenterSettings(form), stands);
    setSavedMessage(null);
    setRequestError(null);
    setRequestState('saving');
    try {
      const persisted = createSettingsForStands(
        await updateEventControlCenterSettings(eventId, nextSettings),
        stands,
      );
      setFormState((current) => ({
        ...current,
        form: persisted,
        saved: persisted,
      }));
      setSavedMessage('Settings saved. Analytics will refresh with these thresholds.');
    } catch {
      setRequestError('Settings could not be saved. Please try again.');
    } finally {
      setRequestState('idle');
    }
  }

  async function resetSettings() {
    setSavedMessage(null);
    setRequestError(null);
    setRequestState('resetting');
    try {
      const reset = createSettingsForStands(await resetEventControlCenterSettings(eventId), stands);
      setFormState((current) => ({
        ...current,
        form: reset,
        saved: reset,
      }));
      setSavedMessage('Settings reset to defaults.');
    } catch {
      setRequestError('Settings could not be reset. Please try again.');
    } finally {
      setRequestState('idle');
    }
  }

  return (
    <div>
      <Card>
        <CardHeader>
          <CardTitle>Alert Thresholds</CardTitle>
        </CardHeader>
        <CardContent>
          <section className="mb-5 rounded-lg border border-border bg-background px-4 py-4">
            <h3 className="font-semibold text-text">Stock Alerts</h3>
            <div className="mt-4 max-w-sm">
              <TextField
                helperText="Products are flagged when their stock reaches this number or lower."
                disabled={isSubmitting}
                id="stock-alert-threshold"
                label="Stock alert threshold"
                min={0}
                onChange={(event) => updateStockAlertThreshold(Number(event.target.value))}
                step={1}
                type="number"
                value={form.stockAlertThreshold ?? defaultStockAlertThreshold}
              />
            </div>
          </section>

          {stands.length > 0 ? (
            <div className="space-y-4">
              {stands.map((stand) => {
                const thresholds =
                  form.standAlertThresholds[stand._id] ?? defaultStandControlCenterThresholds;

                return (
                  <section
                    className="rounded-lg border border-border bg-background px-4 py-4"
                    key={stand._id}
                  >
                    <h3 className="font-semibold text-text [overflow-wrap:anywhere]">
                      {stand.standName}
                    </h3>
                    <div className="mt-4 grid gap-5 md:grid-cols-2">
                      <TextField
                        helperText="This stand is flagged when its open queue reaches this number."
                        disabled={isSubmitting}
                        id={`queue-length-alert-threshold-${stand._id}`}
                        label="Queue length"
                        min={0}
                        onChange={(event) =>
                          updateStandThreshold(
                            stand._id,
                            'queueLengthAlertThreshold',
                            Number(event.target.value),
                          )
                        }
                        step={1}
                        type="number"
                        value={thresholds.queueLengthAlertThreshold}
                      />

                      <TextField
                        helperText="This stand is flagged when its average open-item wait reaches this duration."
                        disabled={isSubmitting}
                        id={`average-wait-alert-threshold-${stand._id}`}
                        label="Average wait in minutes"
                        min={0}
                        onChange={(event) =>
                          updateStandThreshold(
                            stand._id,
                            'averageWaitAlertThresholdMinutes',
                            Number(event.target.value),
                          )
                        }
                        step={1}
                        type="number"
                        value={thresholds.averageWaitAlertThresholdMinutes}
                      />
                    </div>
                  </section>
                );
              })}
            </div>
          ) : (
            <p className="rounded-lg border border-dashed border-border bg-background px-4 py-8 text-center text-sm text-text-muted">
              Create stands before alert thresholds can be configured.
            </p>
          )}

          <div className="mt-6 flex justify-end gap-2">
            <Button disabled={isSubmitting} onClick={resetSettings} size="sm" variant="secondary">
              {requestState === 'resetting' ? 'Resetting…' : 'Reset defaults'}
            </Button>
            <Button disabled={!hasChanges || isSubmitting} onClick={saveSettings} size="sm">
              {requestState === 'saving' ? 'Saving…' : 'Save settings'}
            </Button>
          </div>

          {savedMessage ? (
            <p className="mt-4 rounded-md border border-success/30 bg-success/10 px-3 py-2 text-sm font-medium text-success">
              {savedMessage}
            </p>
          ) : null}
          {requestError ? (
            <p className="mt-4 rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-sm font-medium text-danger">
              {requestError}
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}

function controlCenterSettingsEqual(
  left: EventControlCenterSettings,
  right: EventControlCenterSettings,
): boolean {
  if (
    (left.stockAlertThreshold ?? defaultStockAlertThreshold) !==
    (right.stockAlertThreshold ?? defaultStockAlertThreshold)
  ) {
    return false;
  }

  const standIds = new Set([
    ...Object.keys(left.standAlertThresholds),
    ...Object.keys(right.standAlertThresholds),
  ]);

  for (const standId of standIds) {
    const leftThresholds =
      left.standAlertThresholds[standId] ?? defaultStandControlCenterThresholds;
    const rightThresholds =
      right.standAlertThresholds[standId] ?? defaultStandControlCenterThresholds;

    if (
      leftThresholds.queueLengthAlertThreshold !== rightThresholds.queueLengthAlertThreshold ||
      leftThresholds.averageWaitAlertThresholdMinutes !==
        rightThresholds.averageWaitAlertThresholdMinutes
    ) {
      return false;
    }
  }

  return true;
}
