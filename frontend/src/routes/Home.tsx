import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useAuth } from '../auth/AuthContext';
import { OrganizerNavbar } from '../components/layout/navbars';
import { Button, buttonVariants } from '../components/ui/button';
import OrganizerFooter from '../components/layout/OperatorFooter';
import { paths } from '../paths';

const SECTION_IDS = ['home', 'impact', 'pricing'] as const;

type SectionId = (typeof SECTION_IDS)[number];

export default function Home() {
  const { isAuthenticated, status, logout } = useAuth();
  const [activeSection, setActiveSection] = useState<SectionId>('home');

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);

        if (visible.length > 0) {
          setActiveSection(visible[0].target.id as SectionId);
        }
      },
      {
        root: null,
        rootMargin: '-30% 0px -45% 0px',
        threshold: [0.2, 0.4, 0.6, 0.8],
      },
    );

    SECTION_IDS.forEach((id) => {
      const section = document.getElementById(id);
      if (section) {
        observer.observe(section);
      }
    });

    return () => observer.disconnect();
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <OrganizerNavbar
        centerLinks={[
          { label: 'Home', to: '#home' },
          { label: 'Impact', to: '#impact' },
          { label: 'Pricing', to: '#pricing' },
        ]}
        activeCenterLinkTo={`#${activeSection}`}
        onCenterLinkClick={(to) => {
          const id = to.replace('#', '') as SectionId;
          setActiveSection(id);
          const el = document.getElementById(id);
          if (el) el.scrollIntoView({ behavior: 'smooth' });
        }}
        rightLink={
          status === 'loading'
            ? undefined
            : isAuthenticated
              ? { label: 'Sign Out', onClick: logout }
              : { label: 'Sign In', to: paths.auth }
        }
        widthClassName="w-[calc(100%_-_3rem)] max-w-[calc(80rem-3rem)]"
      />

      <main className="mx-auto max-w-7xl px-6 pb-24">
        {/* Hero */}
        <section id="home" className="scroll-mt-20 pt-20 md:pt-28">
          <div className="grid items-center gap-12 md:grid-cols-2">
            <div>
              <div className="inline-flex items-center rounded-full border border-border bg-accent-soft px-3 py-1 text-xs font-semibold tracking-wide text-accent">
                Built for festivals, venues and high-flow service teams
              </div>

              <h1 className="mt-5 text-5xl font-extrabold leading-[1.1] tracking-tight text-text md:text-6xl">
                Run every event line from one QR code.
              </h1>

              <p className="mt-5 max-w-lg text-lg leading-relaxed text-text-muted">
                lineless connects guest ordering, cashier payments, operator queues, pickup screens
                and live analytics in one branded event workflow.
              </p>

              <div className="mt-8 flex items-center gap-4">
                <Button variant="default" size="md">
                  Get started
                </Button>
                <Link className={buttonVariants({ variant: 'outline', size: 'md' })} to="#">
                  See event flow
                </Link>
              </div>
            </div>

            <div className="relative">
              <div className="h-64 w-full rounded-2xl border border-border bg-surface [box-shadow:var(--shadow-navbar)] md:h-80" />
            </div>
          </div>
        </section>

        {/* Impact */}
        <section className="scroll-mt-20 py-24" id="impact">
          <div className="flex flex-col gap-10 md:flex-row md:items-center">
            <div className="w-full md:w-1/2">
              <div className="h-64 w-full rounded-2xl border border-border bg-surface-muted md:h-80" />
            </div>

            <div className="w-full md:w-1/2">
              <h2 className="text-3xl font-bold leading-tight tracking-tight text-accent sm:text-4xl">
                Less crowd pressure. More time on site.
              </h2>
              <p className="mt-4 max-w-prose text-lg leading-relaxed text-text-muted">
                With smoother customer flow and clearer demand visibility, your team can focus on
                service quality instead of constant queue management. Guests spend less time waiting
                and more time enjoying what your event offers.
              </p>
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section className="scroll-mt-20 pb-20" id="pricing">
          <div className="rounded-2xl border border-border bg-surface p-8 sm:p-12">
            <h2 className="text-3xl font-bold leading-tight tracking-tight text-accent sm:text-4xl">
              Pricing
            </h2>
            <p className="mt-4 max-w-prose text-base leading-relaxed text-text-muted sm:text-lg">
              Pricing section placeholder.
            </p>
          </div>
        </section>

        <OrganizerFooter />
      </main>
    </div>
  );
}
