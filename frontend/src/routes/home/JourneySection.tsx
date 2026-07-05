import { useEffect, useRef } from 'react';
import { CartIcon, PickupIcon, ProductsIcon, StandIcon } from '../../components/icons';
import { CartPhone, EventPhone, PickupPanel, QueuePanel } from './LandingMockups';

const journeySteps = [
  {
    eyebrow: '01 · Scan',
    title: 'Guests open your event',
    text: 'One QR code takes them straight to every stand. No download and no account setup.',
    icon: <StandIcon className="h-5 w-5" />,
    mockup: <EventPhone />,
  },
  {
    eyebrow: '02 · Order',
    title: 'They order on their phone',
    text: 'Guests browse menus, add items and choose the payment flow that fits your event.',
    icon: <CartIcon className="h-5 w-5" />,
    mockup: <CartPhone />,
  },
  {
    eyebrow: '03 · Prepare',
    title: 'Teams work one clear queue',
    text: 'Every stand sees paid orders live and moves them from open to ready in a tap.',
    icon: <ProductsIcon className="h-5 w-5" />,
    mockup: <QueuePanel />,
  },
  {
    eyebrow: '04 · Pick up',
    title: 'Guests return when it is ready',
    text: 'Live status updates keep the crowd moving and the pickup counter under control.',
    icon: <PickupIcon className="h-5 w-5" />,
    mockup: <PickupPanel />,
  },
] as const;

function useJourneyScrollMotion() {
  const journeyRef = useRef<HTMLDivElement>(null);
  const journeyPathRef = useRef<SVGPathElement>(null);
  const journeyDotRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const journey = journeyRef.current;
    const path = journeyPathRef.current;
    const dot = journeyDotRef.current;
    if (!journey || !path || !dot) return;

    const steps = [...journey.querySelectorAll<HTMLElement>('.landing-journey-step')];
    let frame = 0;

    const renderScrollMotion = () => {
      frame = 0;
      const viewportHeight = window.innerHeight;
      const journeyRect = journey.getBoundingClientRect();
      const progress = Math.min(
        1,
        Math.max(
          0,
          (viewportHeight * 0.65 - journeyRect.top) / (journeyRect.height + viewportHeight * 0.3),
        ),
      );

      const svg = path.ownerSVGElement;
      if (svg) {
        const svgRect = svg.getBoundingClientRect();
        const point = path.getPointAtLength(path.getTotalLength() * progress);
        const x = svgRect.left - journeyRect.left + (point.x / 180) * svgRect.width;
        const y = svgRect.top - journeyRect.top + (point.y / 1000) * svgRect.height;
        dot.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;
      }

      steps.forEach((step) => {
        const stepRect = step.getBoundingClientRect();
        const rawReveal = Math.min(
          1,
          Math.max(0, (viewportHeight * 0.9 - stepRect.top) / (viewportHeight * 0.52)),
        );
        const reveal = 1 - Math.pow(1 - rawReveal, 3);
        const direction = step.dataset.side === 'right' ? 1 : -1;
        const visual = step.querySelector<HTMLElement>('.landing-journey-visual');
        const copy = step.querySelector<HTMLElement>('.landing-journey-copy');

        if (visual) {
          visual.style.opacity = String(reveal);
          visual.style.transform = `translate3d(${direction * (1 - reveal) * 96}px, ${(1 - reveal) * 28}px, 0) rotate(${direction * (1 - reveal) * 3}deg)`;
        }
        if (copy) {
          copy.style.opacity = String(Math.min(1, reveal * 1.15));
          copy.style.transform = `translate3d(0, ${(1 - reveal) * 28}px, 0)`;
        }
      });
    };

    const requestRender = () => {
      if (!frame) frame = window.requestAnimationFrame(renderScrollMotion);
    };
    const resizeObserver = new ResizeObserver(requestRender);
    resizeObserver.observe(journey);
    window.addEventListener('scroll', requestRender, { passive: true });
    window.addEventListener('resize', requestRender);
    renderScrollMotion();

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      window.removeEventListener('scroll', requestRender);
      window.removeEventListener('resize', requestRender);
    };
  }, []);

  return { journeyRef, journeyPathRef, journeyDotRef };
}

export function JourneySection() {
  const { journeyRef, journeyPathRef, journeyDotRef } = useJourneyScrollMotion();

  return (
    <section className="relative scroll-mt-20 bg-accent px-6 py-24 text-white sm:py-32" id="impact">
      <div className="mx-auto max-w-[calc(80rem-3rem)]">
        <div className="mx-auto max-w-4xl text-center">
          <p className="landing-eyebrow text-white/55">From scan to served</p>
          <h2 className="landing-display mt-4 text-[clamp(3.2rem,7vw,6.6rem)] leading-[0.84]">
            ONE FLOW.
            <br />
            ZERO CHAOS.
          </h2>
        </div>
        <div className="landing-journey relative mx-auto mt-20 max-w-6xl" ref={journeyRef}>
          <svg
            aria-hidden="true"
            className="landing-journey-line pointer-events-none absolute bottom-0 left-1/2 top-0 hidden h-full w-40 -translate-x-1/2 lg:block"
            preserveAspectRatio="none"
            viewBox="0 0 180 1000"
          >
            <path
              ref={journeyPathRef}
              d="M90 0 C15 90 15 170 90 235 S165 390 90 475 S15 640 90 715 S165 870 90 1000"
              fill="none"
              stroke="white"
              strokeLinecap="round"
              strokeWidth="6"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
          <span
            aria-hidden="true"
            className="landing-journey-scroll-dot pointer-events-none absolute left-0 top-0 z-30 hidden h-4 w-4 rounded-full border-2 border-accent-raised bg-white shadow-[0_0_0_7px_rgba(255,255,255,0.16),0_0_18px_rgba(255,255,255,0.9)] lg:block"
            ref={journeyDotRef}
          />
          <div className="space-y-14 lg:space-y-24">
            {journeySteps.map((step, index) => (
              <article
                className="landing-journey-step relative z-10 grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_10rem_minmax(0,1fr)] lg:gap-0"
                data-side={index % 2 === 0 ? 'right' : 'left'}
                key={step.title}
              >
                <div
                  className={`landing-journey-copy w-full max-w-sm lg:row-start-1 ${index % 2 ? 'lg:col-start-3 lg:justify-self-start' : 'lg:col-start-1 lg:justify-self-end'}`}
                >
                  <div className="landing-step-card">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-accent">
                      {step.icon}
                    </div>
                    <p className="mt-8 text-xs font-black uppercase tracking-[0.18em] text-white/50">
                      {step.eyebrow}
                    </p>
                    <h3 className="mt-2 text-3xl font-black uppercase leading-[0.95]">
                      {step.title}
                    </h3>
                    <p className="mt-4 text-sm leading-relaxed text-white/65">{step.text}</p>
                  </div>
                </div>
                <div className="relative z-20 hidden items-center justify-center lg:col-start-2 lg:row-start-1 lg:flex">
                  <span className="flex h-9 w-9 items-center justify-center rounded-full border-4 border-accent bg-white text-xs font-black text-accent shadow-[0_0_0_8px_rgba(255,255,255,0.12)]">
                    {index + 1}
                  </span>
                </div>
                <div
                  className={`landing-journey-visual flex min-h-80 w-full max-w-sm items-center justify-center lg:row-start-1 ${index % 2 ? 'lg:col-start-1 lg:justify-self-end' : 'lg:col-start-3 lg:justify-self-start'}`}
                >
                  {step.mockup}
                </div>
              </article>
            ))}
          </div>
        </div>
        <h3 className="landing-display mx-auto mt-24 max-w-4xl text-center text-[clamp(3.4rem,7vw,6.7rem)] leading-[0.85]">
          THE WHOLE EVENT
          <br />
          IN YOUR HANDS.
        </h3>
      </div>
    </section>
  );
}
