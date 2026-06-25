import { useState } from 'react';
import { PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';

import { Button } from '@/components/ui/button';

interface CardPaymentFormProps {
  // Confirms the PaymentIntent backing the Elements clientSecret. Resolves only
  // once Stripe reports the hold as authorized (no error, no further action).
  onConfirmed: () => void;
  onError: (message: string) => void;
  submitLabel: string;
}

// Card entry + confirmation. Must be rendered inside <Elements>. The tab's holds
// use manual capture, so a successful confirm leaves the PaymentIntent in
// `requires_capture` — money is held, not taken.
export function CardPaymentForm({ onConfirmed, onError, submitLabel }: CardPaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);

  async function confirm() {
    if (!stripe || !elements) return;

    setSubmitting(true);
    // redirect: 'if_required' keeps the flow in-page for cards that don't need
    // a 3DS redirect; a return_url is still required so cards that do need one
    // can come back here and resume.
    const { error } = await stripe.confirmPayment({
      elements,
      redirect: 'if_required',
      confirmParams: { return_url: window.location.href },
    });
    if (error) {
      setSubmitting(false);
      onError(error.message ?? 'Card authorization failed. Please try again.');
      return;
    }
    onConfirmed();
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void confirm();
      }}
      className="space-y-4"
    >
      <PaymentElement options={{ wallets: { applePay: 'auto', googlePay: 'auto' } }} />
      <Button type="submit" className="h-12 w-full rounded-xl" disabled={!stripe || submitting}>
        {submitting ? 'Authorizing…' : submitLabel}
      </Button>
    </form>
  );
}
