import { useEffect, useRef, useState } from 'react';
import { CheckCircleIcon } from '../../components/icons';
import { PrimaryCta } from './LandingPrimitives';

function RollingPrice() {
  const priceRef = useRef<HTMLSpanElement>(null);
  const [isRolling, setIsRolling] = useState(false);

  useEffect(() => {
    const price = priceRef.current;
    if (!price) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setIsRolling(true);
        observer.disconnect();
      },
      { threshold: 0.65 },
    );

    observer.observe(price);
    return () => observer.disconnect();
  }, []);

  return (
    <span
      aria-label="€0.20"
      className={`landing-rolling-price inline-flex items-center text-6xl font-black leading-none sm:text-7xl ${isRolling ? 'is-rolling' : ''}`}
      ref={priceRef}
    >
      <span aria-hidden="true" className="tracking-[-0.07em]">
        €0.
      </span>
      <span aria-hidden="true" className="landing-price-digit">
        <span className="landing-price-reel landing-price-reel-two">
          {['9', '8', '7', '6', '5', '4', '3', '2'].map((digit) => (
            <span key={digit}>{digit}</span>
          ))}
        </span>
      </span>
      <span aria-hidden="true" className="landing-price-digit">
        <span className="landing-price-reel landing-price-reel-zero">
          {['9', '8', '7', '6', '5', '4', '3', '2', '1', '0'].map((digit) => (
            <span key={digit}>{digit}</span>
          ))}
        </span>
      </span>
    </span>
  );
}

export function PricingSection({ status }: { status: string }) {
  return (
    <section className="scroll-mt-20 px-6 pb-16 pt-8" id="pricing">
      <div className="mx-auto max-w-[calc(80rem-3rem)] overflow-hidden rounded-[2.5rem] bg-accent text-button-text shadow-[0_35px_100px_rgba(2,8,135,0.22)]">
        <div className="grid items-center gap-10 px-7 py-14 sm:px-12 sm:py-20 lg:grid-cols-[1fr_0.8fr] lg:px-20">
          <div>
            <p className="landing-eyebrow text-button-text/65">
              Pricing that waits for opening day
            </p>
            <h2 className="landing-display mt-4 text-[clamp(3.3rem,6.5vw,6.3rem)] leading-[0.84]">
              PAY FOR EVENTS.
              <br />
              <span className="text-button-text/65">NOT PROMISES.</span>
            </h2>
            <p className="mt-6 max-w-2xl text-base leading-relaxed text-white/60 sm:text-lg">
              Create and prepare your event without a monthly software bill. Pay-per-use begins when
              your event goes live.
            </p>
          </div>
          <div className="relative rounded-3xl bg-surface p-7 text-text sm:p-9">
            <div className="absolute right-6 top-0 -translate-y-1/2 rotate-2 rounded-full border border-white/20 bg-accent-raised px-4 py-2 text-xs font-black uppercase tracking-wider text-button-text shadow-[0_10px_28px_rgba(2,8,135,0.28)]">
              Pay per use
            </div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-accent">
              One simple rate*
            </p>
            <div className="mt-3 flex items-end gap-3 border-b border-border pb-6 text-accent">
              <RollingPrice />
              <span className="pb-1.5 text-sm font-black uppercase tracking-wider text-text-muted">
                per order
              </span>
            </div>
            <p className="mt-6 text-xs font-black uppercase tracking-[0.18em] text-accent">
              Included
            </p>
            <ul className="mt-6 space-y-4 text-sm font-bold">
              {[
                'Unlimited event setup',
                'Guest ordering & payment',
                'Operator and pickup views',
                'Live event control center',
              ].map((item) => (
                <li className="flex items-center gap-3" key={item}>
                  <CheckCircleIcon className="h-5 w-5 text-accent" />
                  {item}
                </li>
              ))}
            </ul>
            <PrimaryCta className="mt-8 w-full" status={status} />
            <p className="mt-3 text-center text-xs text-text-muted">
              *Stripe payment rate not included in the order cost.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
