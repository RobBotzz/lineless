import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TextField } from '../../components/ui/text-field';

export default function Settings() {
  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <section>
        <h1 className="text-3xl font-bold text-text">Settings</h1>
        <p className="mt-2 text-sm text-text-muted">Manage your account and preferences</p>
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">Account</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                id="organizer-first-name"
                label="First Name"
                placeholder="First name"
                readOnly
                type="text"
              />

              <TextField
                id="organizer-last-name"
                label="Last Name"
                placeholder="Last name"
                readOnly
                type="text"
              />
            </div>

            <TextField
              id="organizer-email"
              label="Email"
              placeholder="Email"
              readOnly
              type="email"
            />
          </div>

          <div className="mt-6 border-t pt-6">
            <h3 className="mb-4 text-lg font-semibold">Change Password</h3>

            <div className="space-y-4">
              <TextField
                id="current-password"
                label="Current Password"
                placeholder="Current password"
                readOnly
                type="password"
              />

              <TextField
                id="new-password"
                label="New Password"
                placeholder="New password"
                readOnly
                type="password"
              />

              <TextField
                id="confirm-password"
                label="Confirm Password"
                placeholder="Confirm password"
                readOnly
                type="password"
              />
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <Button className="px-6" disabled size="lg">
              Save
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
