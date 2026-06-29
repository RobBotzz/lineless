import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';

import { BackButton, Wordmark } from '@/components/shared';
import { paths } from '@/paths';

// Shared chrome for the standalone legal pages (imprint / privacy). These sit
// outside the organizer/attendee layouts, so they bring their own minimal header;
// the site footer is added by RootLayout.
export function LegalPage({
  title,
  lastUpdated,
  intro,
  children,
}: {
  title: string;
  lastUpdated: string;
  intro?: ReactNode;
  children: ReactNode;
}) {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-3xl items-center px-4 py-4 sm:px-6 lg:px-8">
          <Link to={paths.home} aria-label="Lineless home" className="inline-flex">
            <Wordmark />
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
        <BackButton onClick={() => navigate(-1)} className="self-start">
          Back
        </BackButton>

        <h1 className="mt-6 text-3xl font-bold tracking-tight text-text">{title}</h1>
        <p className="mt-2 text-sm text-text-muted">Last updated: {lastUpdated}</p>

        {intro ? <div className="mt-6 text-sm leading-6 text-text-muted">{intro}</div> : null}

        <div className="mt-8 space-y-8">{children}</div>
      </main>
    </div>
  );
}

// A titled section with muted body copy, matching the rest of the site.
export function LegalSection({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="text-lg font-semibold text-text">{heading}</h2>
      <div className="mt-2 space-y-3 text-sm leading-6 text-text-muted">{children}</div>
    </section>
  );
}
