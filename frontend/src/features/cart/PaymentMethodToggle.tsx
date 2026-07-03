import { Button } from '@/components/ui/button';
import type { PaymentMethod } from '@/features/payment';

interface PaymentMethodToggleProps {
  value: PaymentMethod;
  onChange: (method: PaymentMethod) => void;
  // Hide the Cash option when the event runs no cashier — the backend would
  // reject a cash order anyway (createOrder: !tabId && !cashierEnabled → 4xx).
  cashEnabled?: boolean;
}

export function PaymentMethodToggle({
  value,
  onChange,
  cashEnabled = true,
}: PaymentMethodToggleProps) {
  return (
    <div className="flex gap-2">
      <Button
        variant={value === 'CARD' ? 'default' : 'outline'}
        className="flex-1"
        onClick={() => onChange('CARD')}
      >
        Card
      </Button>
      {cashEnabled ? (
        <Button
          variant={value === 'CASH' ? 'default' : 'outline'}
          className="flex-1"
          onClick={() => onChange('CASH')}
        >
          Cash
        </Button>
      ) : null}
    </div>
  );
}
