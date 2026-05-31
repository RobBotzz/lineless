import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function Payment() {
  return (
    <Card>
      <CardHeader>
        <p className="text-muted-foreground text-sm font-medium uppercase tracking-wide">
          Organizer
        </p>
        <CardTitle className="text-3xl font-bold">Payment</CardTitle>
        <CardDescription className="max-w-2xl">
          Payment settings will be configured here once the payment flow is implemented.
        </CardDescription>
      </CardHeader>
    </Card>
  );
}
