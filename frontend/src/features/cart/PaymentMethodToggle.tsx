import { Button } from '@/components/ui/button';
import type { PaymentMethod } from '@/features/orders/mockPayment';

interface PaymentMethodToggleProps {
  value: PaymentMethod;
  onChange: (method: PaymentMethod) => void;
}

export function PaymentMethodToggle({ value, onChange }: PaymentMethodToggleProps) {
  return (
    <div className="flex gap-2">
      <Button
        variant={value === 'CARD' ? 'default' : 'outline'}
        className="flex-1"
        onClick={() => onChange('CARD')}
      >
        Card
      </Button>
      <Button
        variant={value === 'CASH' ? 'default' : 'outline'}
        className="flex-1"
        onClick={() => onChange('CASH')}
      >
        Cash
      </Button>
    </div>
  );
}
