export function LivePulseMetric({
  alert = false,
  detail,
  label,
  tone,
  value,
}: {
  alert?: boolean;
  detail: string;
  label: string;
  tone: 'accent' | 'danger' | 'neutral' | 'success';
  value: string;
}) {
  const toneClasses = {
    accent: {
      card: 'border-accent/20 bg-accent/5',
      detail: 'text-accent',
      rail: 'bg-accent',
    },
    danger: {
      card: 'border-danger/30 bg-danger/5',
      detail: 'text-danger',
      rail: 'bg-danger',
    },
    neutral: {
      card: 'border-border bg-background',
      detail: 'text-text-muted',
      rail: 'bg-border',
    },
    success: {
      card: 'border-success/25 bg-success/5',
      detail: 'text-success',
      rail: 'bg-success',
    },
  }[tone];

  return (
    <div
      className={[
        'relative overflow-hidden rounded-lg border px-5 py-4 shadow-sm transition',
        toneClasses.card,
        alert ? 'shadow-[0_14px_30px_color-mix(in_srgb,var(--color-danger)_10%,transparent)]' : '',
      ].join(' ')}
    >
      <span className={['absolute inset-x-0 top-0 h-1', toneClasses.rail].join(' ')} />
      <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">{label}</p>
      <p className="mt-2 truncate text-2xl font-bold tabular-nums text-text md:text-3xl">{value}</p>
      <p
        className={['mt-2 truncate text-sm font-semibold tabular-nums', toneClasses.detail].join(
          ' ',
        )}
      >
        {detail}
      </p>
    </div>
  );
}
