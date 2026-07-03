import { HeroDashboard } from './LandingMockups';
import { PrimaryCta } from './LandingPrimitives';

export function HeroSection({ status }: { status: string }) {
  return (
    <section className="relative scroll-mt-20 px-6 pb-28 pt-8 sm:pt-12 lg:pb-36" id="home">
      <div aria-hidden="true" className="landing-grid absolute inset-0 opacity-40" />
      <div className="relative mx-auto grid max-w-[calc(80rem-3rem)] items-center gap-10 lg:grid-cols-[0.88fr_1.12fr] lg:gap-4">
        <div className="relative z-10">
          <h1 className="landing-display max-w-3xl text-[clamp(3.5rem,7.7vw,7.2rem)] leading-[0.83] text-text">
            TURN LINES
            <br />
            INTO <span className="text-accent">GOOD TIMES.</span>
          </h1>
          <p className="mt-7 max-w-xl text-lg font-medium leading-relaxed text-text-muted sm:text-xl">
            One QR-powered flow for ordering, payment, preparation and pickup — built so small event
            teams can serve more guests with less pressure.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <PrimaryCta status={status} />
            <a
              className="inline-flex items-center gap-2 text-sm font-bold text-text transition-colors hover:text-accent"
              href="#impact"
            >
              See how it works <span aria-hidden="true">↓</span>
            </a>
          </div>
          <div className="mt-9 flex flex-wrap gap-x-6 gap-y-2 text-xs font-bold uppercase tracking-[0.12em] text-text-muted">
            <span>✓ No app for guests</span>
            <span>✓ Live event control</span>
            <span>✓ Pay per use</span>
          </div>
        </div>
        <HeroDashboard />
      </div>
    </section>
  );
}
