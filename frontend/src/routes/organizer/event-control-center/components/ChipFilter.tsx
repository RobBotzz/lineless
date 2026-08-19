import { XIcon } from '@/components/icons';

export type ChipFilterOption = {
  label: string;
  value: string;
};

export function ChipFilter({
  ariaLabel,
  label,
  onSelect,
  options,
  resetValue,
  selectedValue,
}: {
  ariaLabel: string;
  label: string;
  onSelect: (value: string) => void;
  options: ChipFilterOption[];
  resetValue?: string;
  selectedValue: string;
}) {
  return (
    <div className="relative space-y-2">
      <p className="text-right text-xs font-semibold uppercase tracking-wide text-text-muted">
        {label}
      </p>
      <div aria-label={ariaLabel} className="flex flex-wrap justify-end gap-2 pb-1" role="group">
        {options.map((option) => (
          <button
            aria-pressed={selectedValue === option.value}
            className={[
              'inline-flex max-w-48 shrink-0 items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-medium shadow-sm transition-colors duration-200 ease-out',
              selectedValue === option.value
                ? 'border-accent bg-accent text-[var(--color-button-text)] shadow-[0_10px_24px_color-mix(in_srgb,var(--color-accent)_18%,transparent)]'
                : 'border-border bg-surface text-text hover:border-accent/30 hover:bg-surface-muted',
            ].join(' ')}
            key={option.value}
            title={option.label}
            type="button"
            onClick={() =>
              onSelect(selectedValue === option.value && resetValue ? resetValue : option.value)
            }
          >
            <span className="truncate">{option.label}</span>
            {selectedValue === option.value && resetValue ? (
              <XIcon className="h-3.5 w-3.5 shrink-0" />
            ) : null}
          </button>
        ))}
      </div>
    </div>
  );
}
