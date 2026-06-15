import { useState } from 'react';

import type { EventControlCenterSettings } from '@/api/eventControlCenter';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TextField } from '@/components/ui/text-field';
import {
  defaultControlCenterSettings,
  normalizeControlCenterSettings,
} from './eventControlCenterSettingsStorage';

export function EventControlCenterSettingsPage({
  onChange,
  settings,
}: {
  onChange: (settings: EventControlCenterSettings) => void;
  settings: EventControlCenterSettings;
}) {
  const [form, setForm] = useState<EventControlCenterSettings>(settings);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  const hasChanges =
    form.queueLengthAlertThreshold !== settings.queueLengthAlertThreshold ||
    form.averageWaitAlertThresholdMinutes !== settings.averageWaitAlertThresholdMinutes;

  function updateField<K extends keyof EventControlCenterSettings>(
    key: K,
    value: EventControlCenterSettings[K],
  ) {
    setSavedMessage(null);
    setForm((current) => ({ ...current, [key]: value }));
  }

  function saveSettings() {
    const normalizedSettings = normalizeControlCenterSettings(form);
    setForm(normalizedSettings);
    onChange(normalizedSettings);
    setSavedMessage('Settings saved. Analytics will refresh with these thresholds.');
  }

  function resetSettings() {
    setForm(defaultControlCenterSettings);
    onChange(defaultControlCenterSettings);
    setSavedMessage('Settings reset to defaults.');
  }

  return (
    <div>
      <Card>
        <CardHeader>
          <CardTitle>Alert Thresholds</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-5 md:grid-cols-2">
            <TextField
              helperText="A stand is flagged when its open queue reaches this number."
              id="queue-length-alert-threshold"
              label="Queue length"
              min={0}
              onChange={(event) =>
                updateField('queueLengthAlertThreshold', Number(event.target.value))
              }
              step={1}
              type="number"
              value={form.queueLengthAlertThreshold}
            />

            <TextField
              helperText="A stand is flagged when its average open-item wait reaches this duration."
              id="average-wait-alert-threshold"
              label="Average wait in minutes"
              min={0}
              onChange={(event) =>
                updateField('averageWaitAlertThresholdMinutes', Number(event.target.value))
              }
              step={1}
              type="number"
              value={form.averageWaitAlertThresholdMinutes}
            />
          </div>

          <div className="mt-6 flex justify-end gap-2">
            <Button onClick={resetSettings} size="sm" variant="secondary">
              Reset defaults
            </Button>
            <Button disabled={!hasChanges} onClick={saveSettings} size="sm">
              Save settings
            </Button>
          </div>

          {savedMessage ? (
            <p className="mt-4 rounded-md border border-success/30 bg-success/10 px-3 py-2 text-sm font-medium text-success">
              {savedMessage}
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
