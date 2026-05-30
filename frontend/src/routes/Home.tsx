import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import logoPlaceholder from '../assets/LLlogo.png';
import { OrganizerNavbar } from '../components/layout';
import { Button, buttonVariants } from '../components/ui/button';

const SECTION_IDS = ['home', 'impact', 'pricing'] as const;

type SectionId = (typeof SECTION_IDS)[number];

export default function Home() {
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
        logoSrc={logoPlaceholder}
        centerLinks={[
          { label: 'Home', to: '#home' },
          { label: 'Impact', to: '#impact' },
          { label: 'Pricing', to: '#pricing' },
        ]}
        activeCenterLinkTo={`#${activeSection}`}
        rightLink={{ label: 'Sign In', to: '/' }} // richtiger Link noch hinzufügen.
      />

      <main className="mx-auto max-w-7xl px-6 py-20">
        <section id="home">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            {/* Left column: text */}
            <div>
              <div className="inline-flex items-center rounded-full border border-border px-3 py-1 my-2 text-sm font-semibold text-accent bg-accent-soft">
                Built for festivals, venues and high-flow service teams
              </div>

              <h1 className="mt-4 text-5xl font-bold tracking-tight text-accent">
                Run every event line from one QR code.
              </h1>

              <p className="mt-6 text-lg text-text">
                lineless connects guest ordering, cashier payments, operator queues, pickup screens
                and live analytics in one brandede event workflow.
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

            {/* Right column: placeholder preview */}
            <div className="relative">
              <div className="rounded-2xl bg-surface p-2 shadow-2xl">
                <div className="aspect-video bg-accent-soft rounded-xl" />
              </div>
            </div>
          </div>
        </section>

        <section className="py-20" id="impact">
          <div className="flex flex-col gap-10 md:flex-row md:items-center">
            <div className="w-full md:w-1/2">
              <div className="h-64 w-full rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface-muted)] md:h-80" />
            </div>

            <div className="w-full md:w-1/2">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl text-[var(--color-accent)]">
                Less crowd pressure. More time on site.
              </h2>
              <p className="mt-5 text-base leading-7 sm:text-lg text-[var(--color-text-muted)]">
                With smoother customer flow and clearer demand visibility, your team can focus on
                service quality instead of constant queue management. Guests spend less time waiting
                and more time enjoying what your event offers.
              </p>
            </div>
          </div>
        </section>

        <section className="pb-20" id="pricing">
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8 sm:p-12">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl text-[var(--color-accent)]">
              Pricing
            </h2>
            <p className="mt-4 text-base sm:text-lg text-[var(--color-text-muted)]">
              Pricing section placeholder.
            </p>
          </div>
        </section>

        <footer className="border-t border-[var(--color-border)] pt-10">
          <div className="grid grid-cols-1 gap-8 pb-8 sm:grid-cols-2 md:grid-cols-3">
            <div>
              <p className="text-lg font-bold text-[var(--color-accent)]">lineless</p>
              <p className="mt-2 text-sm text-[var(--color-text-muted)]">
                Smarter guest flow for better event experiences.
              </p>
            </div>

            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-[var(--color-text)]">
                Sitemap
              </p>
              <div className="mt-3 flex flex-col gap-2 text-sm">
                <a className="hover:underline" href="#home">
                  Home
                </a>
                <a className="hover:underline" href="#impact">
                  Impact
                </a>
                <a className="hover:underline" href="#pricing">
                  Pricing
                </a>
              </div>
            </div>

            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-[var(--color-text)]">
                Legal
              </p>
              <div className="mt-3 flex flex-col gap-2 text-sm">
                <a className="hover:underline" href="#">
                  Impressum
                </a>
                <a className="hover:underline" href="#">
                  Privacy Policy
                </a>
                <a className="hover:underline" href="#">
                  Terms of Service
                </a>
              </div>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
