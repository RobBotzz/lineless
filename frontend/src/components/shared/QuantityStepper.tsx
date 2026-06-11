import { MinusIcon, PlusIcon } from '@/components/icons';

// Shared styling for the small square +/- buttons. Exported so a caller that
// needs a single bare stepper button can reuse the exact look.
export const stepperButtonClass =
  'inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-surface text-text transition-colors hover:bg-surface-muted disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent';

interface QuantityStepperProps {
  quantity: number;
  onDecrease: () => void;
  onIncrease: () => void;
  decreaseLabel: string;
  increaseLabel: string;
  disableDecrease?: boolean;
  disableIncrease?: boolean;
}

// A minus / value / plus control. The disable flags are passed in (not derived)
// because callers differ: the cart line disables minus at 1, while the product
// card keeps it enabled so it can drop to 0 and remove the line.
export function QuantityStepper({
  quantity,
  onDecrease,
  onIncrease,
  decreaseLabel,
  increaseLabel,
  disableDecrease = false,
  disableIncrease = false,
}: QuantityStepperProps) {
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        className={stepperButtonClass}
        onClick={onDecrease}
        disabled={disableDecrease}
        aria-label={decreaseLabel}
      >
        <MinusIcon />
      </button>
      <span className="min-w-6 text-center text-sm font-semibold text-text" aria-live="polite">
        {quantity}
      </span>
      <button
        type="button"
        className={stepperButtonClass}
        onClick={onIncrease}
        disabled={disableIncrease}
        aria-label={increaseLabel}
      >
        <PlusIcon />
      </button>
    </div>
  );
}
