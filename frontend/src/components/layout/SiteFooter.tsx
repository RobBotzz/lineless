import { Link } from 'react-router';

import { Wordmark } from '@/components/shared';
import { paths } from '@/paths';

const COMPANY = 'Lineless';

const LEGAL_LINKS: { label: string; to: string }[] = [
  { label: 'Imprint', to: paths.imprint },
  { label: 'Privacy Policy', to: paths.privacy },
];

const RESOURCE_LINKS: { label: string; to: string }[] = [
  { label: 'For organizers', to: paths.organizer.root },
];

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="mt-12 border-t border-border bg-surface">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand + legal provider identity (Impressum) */}
          <div className="sm:col-span-2">
            <Link to={paths.home} aria-label={`${COMPANY} home`} className="inline-flex">
              <Wordmark />
            </Link>
            <p className="mt-3 max-w-sm text-sm leading-6 text-text-muted">
              Pay-per-use digital queuing and ordering for small-scale event organizers.
            </p>
            <address className="mt-4 text-sm not-italic leading-6 text-text-muted">
              Operated by Robin Böck, Amelie Frenzel, Tim Michalow &amp; Daniel Sich
              <br />
              Boltzmannstraße 15, 85748 Garching, Germany
            </address>
          </div>

          {/* Legal — GDPR / Impressum links */}
          <nav aria-label="Legal">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-text">Legal</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {LEGAL_LINKS.map((link) => (
                <li key={link.to}>
                  <Link className="text-text-muted transition-colors hover:text-text" to={link.to}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Resources + contact */}
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-widest text-text">Resources</h2>
            <ul className="mt-3 space-y-2 text-sm">
              {RESOURCE_LINKS.map((link) => (
                <li key={link.to}>
                  <Link className="text-text-muted transition-colors hover:text-text" to={link.to}>
                    {link.label}
                  </Link>
                </li>
              ))}
              <li>
                <a
                  className="text-text-muted transition-colors hover:text-text"
                  href="mailto:contact@lineless.shop"
                >
                  contact@lineless.shop
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-8 border-t border-border pt-5 text-sm text-text-muted">
          <p>
            © {year} {COMPANY}. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
