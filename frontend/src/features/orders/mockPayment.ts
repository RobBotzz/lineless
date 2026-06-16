export type PaymentMethod = 'CARD' | 'CASH';

// TODO: integrate actual payment gateway here.
export function mockProcessPayment(_method: PaymentMethod): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 1000));
}
