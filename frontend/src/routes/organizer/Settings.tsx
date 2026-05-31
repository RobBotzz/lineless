import { Button } from '../../components/ui/button';
import { TextField } from '../../components/ui/text-field';

export default function Settings() {
  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <section>
        <h1 className="text-3xl font-bold text-text">Settings</h1>
        <p className="mt-2 text-sm text-text-muted">Manage your account and preferences</p>
      </section>

      <section className="rounded-lg border border-border bg-surface p-6 shadow-sm sm:p-8">
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-text">Account</h2>
        </div>

        <div className="mb-6 space-y-4">
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

          <TextField id="organizer-email" label="Email" placeholder="Email" readOnly type="email" />
        </div>

        <div className="border-t border-border pt-6">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-text">Change Password</h3>
          </div>

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
      </section>
    </div>
  );
}
