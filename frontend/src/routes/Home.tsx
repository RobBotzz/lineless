import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { useOrganizerAuth } from '../auth/organizer/OrganizerAuthContext';
import {
  ArrowRightIcon,
  CartIcon,
  CheckCircleIcon,
  CreditCardIcon,
  DashboardIcon,
  PickupIcon,
  ProductsIcon,
  StandIcon,
} from '../components/icons';
import { AccountMenu, LandingPageNavbar } from '../components/layout/navbars';
import { buttonVariants } from '../components/ui/button';
import heroLayers from '../assets/hero.png';
import { paths } from '../paths';

const SECTION_IDS = ['home', 'impact', 'pricing'] as const;

type SectionId = (typeof SECTION_IDS)[number];

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

function PrimaryCta({ status, className = '' }: { status: string; className?: string }) {
  const authenticated = status !== 'unauthenticated';

  return (
    <Link
      className={`${buttonVariants({ variant: 'default', size: 'lg' })} landing-cta gap-2 ${className}`}
      to={authenticated ? paths.organizer.root : paths.auth}
    >
      {authenticated ? 'Go to my dashboard' : 'Plan your first event'}
      <ArrowRightIcon />
    </Link>
  );
}

function WindowShell({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={`overflow-hidden rounded-[1.35rem] border border-white/15 bg-[#f8f8fb] shadow-[0_30px_80px_rgba(0,0,0,0.25)] ${className}`}
    >
      <div className="flex h-8 items-center gap-1.5 border-b border-black/8 bg-white px-3">
        <span className="h-2 w-2 rounded-full bg-[#ff6b6b]" />
        <span className="h-2 w-2 rounded-full bg-[#ffd166]" />
        <span className="h-2 w-2 rounded-full bg-[#61d095]" />
      </div>
      {children}
    </div>
  );
}

function HeroDashboard() {
  return (
    <div className="landing-hero-visual relative mx-auto min-h-[31rem] w-full max-w-[38rem] sm:min-h-[36rem]">
      <img
        aria-hidden="true"
        className="landing-layer-art absolute right-[2%] top-[2%] w-52 opacity-30 sm:w-64"
        src={heroLayers}
      />

      <WindowShell className="landing-float-slow absolute left-0 top-10 w-[92%] -rotate-2 sm:left-[2%] sm:w-[88%]">
        <div className="grid min-h-[24rem] grid-cols-[4.5rem_1fr] bg-[#f5f5f8] text-[#1f2937] sm:grid-cols-[7rem_1fr]">
          <aside className="border-r border-black/6 bg-white p-3 sm:p-4">
            <span className="font-logo text-lg text-accent">lineless</span>
            <div className="mt-8 space-y-3 text-[0.55rem] font-semibold text-slate-400 sm:text-[0.65rem]">
              <p className="rounded-md bg-accent-soft px-2 py-2 text-accent">Overview</p>
              <p className="px-2">Orders</p>
              <p className="px-2">Stands</p>
              <p className="px-2">Analytics</p>
            </div>
          </aside>
          <div className="p-4 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[0.55rem] font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Event control center
                </p>
                <h3 className="mt-1 text-sm font-extrabold sm:text-lg">Summer Nights Festival</h3>
              </div>
              <span className="rounded-full bg-emerald-100 px-2 py-1 text-[0.55rem] font-bold text-emerald-700">
                ● LIVE
              </span>
            </div>
            <div className="mt-5 grid grid-cols-3 gap-2 sm:gap-3">
              {[
                ['€ 4,820', 'Revenue'],
                ['384', 'Orders'],
                ['06:42', 'Avg. wait'],
              ].map(([value, label]) => (
                <div className="rounded-lg border border-black/6 bg-white p-2.5 sm:p-3" key={label}>
                  <p className="text-xs font-black sm:text-base">{value}</p>
                  <p className="mt-1 text-[0.5rem] text-slate-400 sm:text-[0.6rem]">{label}</p>
                </div>
              ))}
            </div>
            <div className="mt-3 rounded-xl border border-black/6 bg-white p-3 sm:p-4">
              <div className="flex items-center justify-between">
                <p className="text-[0.6rem] font-bold sm:text-xs">Revenue over time</p>
                <p className="text-[0.5rem] text-slate-400">Last 6 hours</p>
              </div>
              <svg aria-hidden="true" className="mt-4 h-24 w-full" viewBox="0 0 320 90">
                <defs>
                  <linearGradient id="chart-fill" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0" stopColor="#020887" stopOpacity=".25" />
                    <stop offset="1" stopColor="#020887" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path
                  d="M0 76 C35 70 44 52 74 57 S120 37 149 42 S187 20 218 29 S270 9 320 14 L320 90 L0 90Z"
                  fill="url(#chart-fill)"
                />
                <path
                  d="M0 76 C35 70 44 52 74 57 S120 37 149 42 S187 20 218 29 S270 9 320 14"
                  fill="none"
                  stroke="#020887"
                  strokeLinecap="round"
                  strokeWidth="4"
                />
              </svg>
            </div>
          </div>
        </div>
      </WindowShell>

      <div className="landing-float-fast absolute bottom-2 right-0 w-40 rotate-3 rounded-[1.8rem] border-[5px] border-[#17171b] bg-white p-2 shadow-[0_30px_70px_rgba(0,0,0,0.32)] sm:w-48">
        <div className="overflow-hidden rounded-[1.25rem] bg-[#f5f5f8] px-3 pb-4 pt-5 text-[#1f2937]">
          <p className="text-[0.5rem] font-bold uppercase tracking-widest text-accent">
            Summer Nights
          </p>
          <p className="mt-1 text-sm font-black">What can we get you?</p>
          <div className="mt-3 space-y-2">
            {[
              ['Smash Burger', '€ 9.50'],
              ['Loaded Fries', '€ 6.00'],
              ['Lemonade', '€ 3.50'],
            ].map(([name, price], index) => (
              <div className="flex items-center gap-2 rounded-lg bg-white p-2" key={name}>
                <div
                  className={`h-8 w-8 rounded-md ${index === 0 ? 'bg-[#ffd166]' : index === 1 ? 'bg-[#ff8f70]' : 'bg-[#a5d8ff]'}`}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[0.55rem] font-bold">{name}</p>
                  <p className="text-[0.5rem] text-slate-400">{price}</p>
                </div>
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[0.65rem] text-white">
                  +
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function EventPhone() {
  return (
    <div className="mx-auto w-32 rounded-[1.5rem] border-4 border-[#111218] bg-white p-2 shadow-xl">
      <div className="rounded-[1rem] bg-[#f3f4f8] px-2 py-5 text-left">
        <p className="text-[0.4rem] font-bold text-accent">SUMMER NIGHTS</p>
        <p className="mt-1 text-[0.65rem] font-black">Choose a stand</p>
        {['Main bar', 'Food court', 'Merch'].map((item) => (
          <div className="mt-2 rounded-md bg-white p-2 text-[0.45rem] font-semibold" key={item}>
            {item}
          </div>
        ))}
      </div>
    </div>
  );
}

function CartPhone() {
  return (
    <div className="mx-auto w-32 rounded-[1.5rem] border-4 border-[#111218] bg-white p-2 shadow-xl">
      <div className="rounded-[1rem] bg-[#f3f4f8] px-2 py-5 text-left">
        <p className="text-[0.45rem] font-bold text-accent">YOUR ORDER</p>
        <p className="mt-2 text-[0.65rem] font-black">2 items</p>
        <div className="mt-2 rounded-md bg-white p-2 text-[0.45rem]">Burger × 1</div>
        <div className="mt-1 rounded-md bg-white p-2 text-[0.45rem]">Lemonade × 1</div>
        <div className="mt-3 rounded-md bg-accent py-2 text-center text-[0.45rem] font-bold text-white">
          Pay € 13.00
        </div>
      </div>
    </div>
  );
}

function QueuePanel() {
  return (
    <div className="mx-auto w-44 rotate-2 rounded-xl border border-black/10 bg-[#f5f5f8] p-3 text-left shadow-xl">
      <p className="text-[0.55rem] font-black">Burger stand</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {['#A14', '#A15', '#A16', '#A17'].map((order, index) => (
          <div className="rounded-md bg-white p-2" key={order}>
            <p className="text-[0.5rem] font-bold">{order}</p>
            <div
              className={`mt-2 h-1.5 rounded-full ${index < 2 ? 'bg-amber-300' : 'bg-accent/30'}`}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function PickupPanel() {
  return (
    <div className="mx-auto w-44 -rotate-2 rounded-xl bg-[#111218] p-3 text-left text-white shadow-xl">
      <p className="text-[0.45rem] font-bold uppercase tracking-widest text-white/50">
        Ready for pickup
      </p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {['A12', 'A13', 'B04', 'B05'].map((order) => (
          <div className="rounded-md bg-white/10 p-2 text-center text-sm font-black" key={order}>
            {order}
          </div>
        ))}
      </div>
    </div>
  );
}

function FeatureDashboard() {
  return (
    <WindowShell className="w-full">
      <div className="grid min-h-64 grid-cols-[5rem_1fr] bg-[#f5f5f8] sm:grid-cols-[8rem_1fr]">
        <div className="border-r border-black/6 bg-white p-3 text-[0.55rem] font-semibold text-slate-400 sm:p-5">
          <span className="font-logo text-base text-accent">lineless</span>
          <p className="mt-7 rounded-md bg-accent-soft p-2 text-accent">Live control</p>
          <p className="mt-2 p-2">Analytics</p>
          <p className="mt-2 p-2">Settings</p>
        </div>
        <div className="p-4 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[0.5rem] uppercase tracking-widest text-slate-400">Event health</p>
              <p className="text-xs font-black sm:text-base">Everything in one view</p>
            </div>
            <span className="rounded-full bg-emerald-100 px-2 py-1 text-[0.5rem] font-bold text-emerald-700">
              LIVE
            </span>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {['Orders 384', 'Open 28', 'Ready 12'].map((item) => (
              <div
                className="rounded-lg bg-white p-3 text-[0.5rem] font-bold sm:text-[0.65rem]"
                key={item}
              >
                {item}
              </div>
            ))}
          </div>
          <div className="mt-3 space-y-2">
            {[
              ['Main bar', 'Healthy', 'bg-emerald-400'],
              ['Burger stand', 'Busy', 'bg-amber-400'],
              ['Pizza stand', 'Healthy', 'bg-emerald-400'],
            ].map(([name, state, color]) => (
              <div
                className="flex items-center justify-between rounded-lg bg-white p-3 text-[0.55rem] sm:text-[0.65rem]"
                key={name}
              >
                <span className="font-bold">{name}</span>
                <span className="flex items-center gap-1.5 text-slate-500">
                  <i className={`h-1.5 w-1.5 rounded-full ${color}`} />
                  {state}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </WindowShell>
  );
}

export default function Home() {
  const { isAuthenticated, status, logout } = useOrganizerAuth();
  const [activeSection, setActiveSection] = useState<SectionId>('home');

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);

        if (visible.length > 0) setActiveSection(visible[0].target.id as SectionId);
      },
      { root: null, rootMargin: '-30% 0px -45% 0px', threshold: [0.2, 0.4, 0.6, 0.8] },
    );

    SECTION_IDS.forEach((id) => {
      const section = document.getElementById(id);
      if (section) observer.observe(section);
    });

    return () => observer.disconnect();
  }, []);

  return (
    <div className="landing-page min-h-screen overflow-hidden bg-background">
      <LandingPageNavbar
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
        right={
          status === 'loading' ? null : (
            <AccountMenu isAuthenticated={isAuthenticated} onSignOut={logout} />
          )
        }
        widthClassName="w-[calc(100%_-_3rem)] max-w-[calc(80rem-3rem)]"
      />

      <main>
        <section className="relative scroll-mt-20 px-6 pb-28 pt-16 sm:pt-24 lg:pb-36" id="home">
          <div aria-hidden="true" className="landing-grid absolute inset-0 opacity-40" />
          <div className="relative mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[0.88fr_1.12fr] lg:gap-4">
            <div className="relative z-10">
              <div className="landing-kicker">
                <span className="h-2 w-2 rounded-full bg-accent" />
                Built for busy event days
              </div>
              <h1 className="landing-display mt-6 max-w-3xl text-[clamp(3.5rem,7.7vw,7.2rem)] leading-[0.83] text-[#17171b]">
                TURN LINES
                <br />
                INTO <span className="text-accent">GOOD TIMES.</span>
              </h1>
              <p className="mt-7 max-w-xl text-lg font-medium leading-relaxed text-text-muted sm:text-xl">
                One QR-powered flow for ordering, payment, preparation and pickup — built so small
                event teams can serve more guests with less pressure.
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

        <div className="landing-tear landing-tear-dark" />
        <section className="bg-[#17171b] px-6 py-24 text-white sm:py-32">
          <div className="mx-auto max-w-7xl">
            <p className="landing-eyebrow text-white/50">The queue costs more than time</p>
            <h2 className="landing-display mt-4 max-w-5xl text-[clamp(3.2rem,7vw,6.5rem)] leading-[0.86]">
              YOUR BEST MOMENTS
              <br />
              SHOULDN&apos;T HAPPEN
              <br />
              <span className="text-[#8e94ff]">IN A LINE.</span>
            </h2>
            <div className="mt-14 grid gap-5 md:grid-cols-3">
              {[
                [
                  '01',
                  'Guests miss the event',
                  'Long waits pull people away from stages, friends and the moments they came for.',
                ],
                [
                  '02',
                  'Teams lose the overview',
                  'Paper tickets and shouted order numbers make every rush harder to manage.',
                ],
                [
                  '03',
                  'Revenue stops at the queue',
                  'When the line looks too long, guests skip the second round before it starts.',
                ],
              ].map(([number, title, copy], index) => (
                <article
                  className={`landing-problem-card ${index === 1 ? 'md:translate-y-6 md:rotate-1' : index === 2 ? 'md:-rotate-1' : 'md:-rotate-2'}`}
                  key={number}
                >
                  <span className="text-xs font-black tracking-widest text-white/50">{number}</span>
                  <h3 className="mt-14 text-2xl font-black uppercase leading-none">{title}</h3>
                  <p className="mt-4 text-sm leading-relaxed text-white/65">{copy}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
        <div className="landing-tear landing-tear-light" />

        <section className="px-6 py-24 text-center sm:py-36">
          <div className="mx-auto max-w-5xl">
            <p className="landing-eyebrow text-accent">Skip the queue, keep the energy</p>
            <h2 className="landing-display mt-4 text-[clamp(3.4rem,7.5vw,7rem)] leading-[0.84] text-[#17171b]">
              ORDER. ENJOY.
              <br />
              <span className="text-accent">PICK UP.</span>
            </h2>
            <p className="mx-auto mt-7 max-w-2xl text-lg leading-relaxed text-text-muted">
              lineless makes every order visible from the guest&apos;s first tap to the team&apos;s
              final handoff. No guesswork, no crowded counter.
            </p>
          </div>
          <div className="mx-auto mt-16 grid max-w-6xl grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-5">
            {['SCAN', 'ORDER', 'ENJOY', 'PICK UP'].map((label, index) => (
              <div
                className={`landing-polaroid ${index % 2 === 0 ? '-rotate-2' : 'rotate-2'}`}
                key={label}
              >
                <div
                  className={`flex aspect-[4/5] items-center justify-center rounded-lg ${['bg-[#c9ccff]', 'bg-[#ffd166]', 'bg-[#ff9b85]', 'bg-[#96e6c7]'][index]}`}
                >
                  <span className="landing-display text-[clamp(2.2rem,5vw,4.8rem)] leading-none text-[#17171b]">
                    {index + 1}
                  </span>
                </div>
                <p className="mt-3 text-left text-xs font-black tracking-widest text-[#17171b]">
                  {label}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section
          className="relative scroll-mt-20 bg-accent px-6 py-24 text-white sm:py-32"
          id="impact"
        >
          <div className="mx-auto max-w-7xl">
            <div className="mx-auto max-w-4xl text-center">
              <p className="landing-eyebrow text-white/55">From scan to served</p>
              <h2 className="landing-display mt-4 text-[clamp(3.2rem,7vw,6.6rem)] leading-[0.84]">
                ONE FLOW.
                <br />
                ZERO CHAOS.
              </h2>
            </div>
            <div className="relative mx-auto mt-20 max-w-5xl">
              <svg
                aria-hidden="true"
                className="landing-journey-line absolute left-1/2 top-0 hidden h-full w-48 -translate-x-1/2 lg:block"
                preserveAspectRatio="none"
                viewBox="0 0 180 1000"
              >
                <path
                  d="M90 0 C15 90 15 170 90 235 S165 390 90 475 S15 640 90 715 S165 870 90 1000"
                  fill="none"
                  stroke="white"
                  strokeLinecap="round"
                  strokeWidth="8"
                />
              </svg>
              <div className="space-y-12 lg:space-y-20">
                {journeySteps.map((step, index) => (
                  <article
                    className={`relative z-10 grid items-center gap-8 lg:grid-cols-2 lg:gap-40 ${index % 2 ? '' : ''}`}
                    key={step.title}
                  >
                    <div className={index % 2 ? 'lg:order-2' : ''}>
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
                    <div
                      className={`flex min-h-64 items-center justify-center ${index % 2 ? 'lg:order-1' : ''}`}
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

        <section className="px-6 py-24 sm:py-36">
          <div className="mx-auto max-w-7xl">
            <div className="grid items-center gap-12 lg:grid-cols-[0.75fr_1.25fr] lg:gap-20">
              <div>
                <span className="landing-icon-badge">
                  <DashboardIcon className="h-5 w-5" />
                </span>
                <p className="landing-eyebrow mt-6 text-accent">Control &amp; clarity</p>
                <h2 className="landing-display mt-4 text-[clamp(3rem,5.5vw,5.5rem)] leading-[0.86] text-[#17171b]">
                  SEE THE RUSH
                  <br />
                  BEFORE YOU
                  <br />
                  <span className="text-accent">FEEL IT.</span>
                </h2>
                <p className="mt-6 max-w-lg text-base leading-relaxed text-text-muted">
                  Live orders, stand health, stock signals and revenue come together in one
                  operational view, so your team can act while it still matters.
                </p>
                <ul className="mt-7 space-y-3 text-sm font-bold text-text">
                  {[
                    'Live event-wide performance',
                    'Real-time order and pickup states',
                    'Clear stand-level bottleneck signals',
                  ].map((item) => (
                    <li className="flex items-center gap-3" key={item}>
                      <CheckCircleIcon className="h-5 w-5 text-accent" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="relative">
                <div
                  aria-hidden="true"
                  className="absolute -inset-5 rotate-2 rounded-[2rem] bg-[#c9ccff]"
                />
                <div className="relative -rotate-1">
                  <FeatureDashboard />
                </div>
              </div>
            </div>

            <div className="mt-28 grid gap-5 md:grid-cols-3">
              {[
                [
                  <CreditCardIcon className="h-6 w-6" />,
                  'Flexible payments',
                  'Run card and cash workflows side by side without splitting your operation.',
                ],
                [
                  <StandIcon className="h-6 w-6" />,
                  'Every stand connected',
                  'Give each team exactly the queue and controls they need for their service point.',
                ],
                [
                  <PickupIcon className="h-6 w-6" />,
                  'Pickup that stays calm',
                  'Show ready orders clearly and keep crowds away from the service counter.',
                ],
              ].map(([icon, title, copy]) => (
                <article
                  className="rounded-3xl border border-border bg-surface p-7 shadow-[0_20px_60px_rgba(2,8,135,0.06)]"
                  key={String(title)}
                >
                  <span className="landing-icon-badge">{icon}</span>
                  <h3 className="mt-8 text-xl font-black uppercase">{title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-text-muted">{copy}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="scroll-mt-20 px-6 pb-16 pt-8" id="pricing">
          <div className="mx-auto max-w-7xl overflow-hidden rounded-[2.5rem] bg-[#17171b] text-white shadow-[0_35px_100px_rgba(0,0,0,0.2)]">
            <div className="grid items-center gap-10 px-7 py-14 sm:px-12 sm:py-20 lg:grid-cols-[1fr_0.8fr] lg:px-20">
              <div>
                <p className="landing-eyebrow text-[#8e94ff]">Pricing that waits for opening day</p>
                <h2 className="landing-display mt-4 text-[clamp(3.3rem,6.5vw,6.3rem)] leading-[0.84]">
                  PAY FOR EVENTS.
                  <br />
                  <span className="text-[#8e94ff]">NOT PROMISES.</span>
                </h2>
                <p className="mt-6 max-w-2xl text-base leading-relaxed text-white/60 sm:text-lg">
                  Create and prepare your event without a monthly software bill. Pay-per-use begins
                  when your event goes live.
                </p>
              </div>
              <div className="relative rounded-3xl bg-white p-7 text-[#17171b] sm:p-9">
                <div className="absolute right-6 top-0 -translate-y-1/2 rotate-2 rounded-full bg-[#ffd166] px-4 py-2 text-xs font-black uppercase tracking-wider">
                  Pay per use
                </div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-accent">
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
                  Start setting up before the gates open.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
