import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { useOrganizerAuth } from '../auth/organizer/OrganizerAuthContext';
import {
  ArrowRightIcon,
  CartIcon,
  CashierIcon,
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
      className={`overflow-hidden rounded-[1.35rem] border border-border bg-surface shadow-[0_30px_80px_rgba(2,8,135,0.2)] ${className}`}
    >
      <div className="flex h-8 items-center gap-1.5 border-b border-border bg-surface px-3">
        <span className="h-2 w-2 rounded-full bg-accent/20" />
        <span className="h-2 w-2 rounded-full bg-accent/40" />
        <span className="h-2 w-2 rounded-full bg-accent" />
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
        <div className="min-h-[24rem] bg-background p-3 text-text sm:p-5">
          <div className="flex items-center justify-between rounded-lg border border-border bg-surface px-3 py-2 shadow-sm">
            <span className="font-logo text-base text-accent">lineless</span>
            <div className="flex items-center gap-1 rounded-md bg-background p-1 text-[0.45rem] font-semibold text-text-muted sm:text-[0.55rem]">
              <span className="rounded bg-surface px-2 py-1 text-text">Management</span>
              <span className="px-2 py-1">Analytics</span>
              <span className="px-2 py-1">Settings</span>
            </div>
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent-soft text-[0.5rem] font-bold text-accent">
              SN
            </span>
          </div>
          <div className="mt-3 rounded-lg border border-border bg-surface p-3 shadow-sm sm:p-4">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold sm:text-base">Summer Nights Festival</h3>
                <p className="mt-1 text-[0.5rem] text-text-muted">Last updated: 21:42</p>
              </div>
              <span className="inline-flex items-center gap-1 text-[0.5rem] font-semibold text-success">
                <i className="h-1.5 w-1.5 rounded-full bg-success" /> Live
              </span>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {[
              ['Revenue', '€4,820', 'bg-accent'],
              ['Open orders', '28', 'bg-border'],
              ['Avg. wait', '06:42', 'bg-success'],
            ].map(([label, value, rail]) => (
              <div
                className="relative overflow-hidden rounded-lg border border-border bg-surface p-2.5 shadow-sm sm:p-3"
                key={label}
              >
                <i className={`absolute inset-x-0 top-0 h-1 ${rail}`} />
                <p className="truncate text-[0.45rem] font-semibold uppercase tracking-wide text-text-muted">
                  {label}
                </p>
                <p className="mt-1 truncate text-xs font-bold tabular-nums text-text sm:text-base">
                  {value}
                </p>
              </div>
            ))}
          </div>
          <div className="mt-3 rounded-lg border border-border bg-surface p-3 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-[0.55rem] font-bold">Live orders</p>
              <span className="rounded-full border border-border bg-background px-2 py-1 text-[0.45rem] text-text-muted">
                All stands
              </span>
            </div>
            <div className="mt-2 space-y-1.5">
              {[
                ['#A14', 'Burger stand', '2 items', 'Preparing'],
                ['#A15', 'Main bar', '3 items', 'Paid'],
                ['#A16', 'Pizza stand', '1 item', 'Ready'],
              ].map(([order, stand, items, state]) => (
                <div
                  className="grid grid-cols-[auto_1fr_auto] items-center gap-2 rounded-md border border-border bg-background px-2.5 py-2 text-[0.45rem] sm:text-[0.52rem]"
                  key={order}
                >
                  <span className="font-bold text-text">{order}</span>
                  <span className="truncate text-text-muted">
                    {stand} · {items}
                  </span>
                  <span
                    className={
                      state === 'Ready' ? 'font-semibold text-success' : 'font-semibold text-accent'
                    }
                  >
                    {state}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </WindowShell>

      <div className="landing-float-fast absolute bottom-2 right-0 w-40 rotate-3 rounded-[1.8rem] border-[5px] border-accent bg-surface p-2 shadow-[0_30px_70px_rgba(2,8,135,0.28)] sm:w-48">
        <ProductSelectionMockup />
      </div>
    </div>
  );
}

function ProductSelectionMockup({ compact = true }: { compact?: boolean }) {
  return (
    <div className="overflow-hidden rounded-[1.25rem] bg-background px-3 pb-3 pt-5 text-text">
      <div className="flex gap-1 overflow-hidden text-[0.4rem] font-semibold">
        <span className="rounded-full border border-accent bg-accent px-2 py-1 text-button-text">
          All
        </span>
        <span className="rounded-full border border-border bg-surface px-2 py-1">Main bar</span>
      </div>
      <div className="mt-3 space-y-2">
        {(compact
          ? [
              ['Smash Burger', '€9.50'],
              ['Lemonade', '€3.50'],
            ]
          : [
              ['Smash Burger', '€9.50'],
              ['Loaded Fries', '€6.00'],
            ]
        ).map(([name, price]) => (
          <div
            className="flex items-center gap-2 rounded-lg border border-border bg-surface p-2 shadow-sm"
            key={name}
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-surface-muted text-accent">
              <ProductsIcon className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[0.5rem] font-semibold">{name}</p>
              <p className="mt-1 text-[0.45rem] font-semibold">{price}</p>
            </div>
            <span className="rounded bg-accent px-1.5 py-1 text-[0.4rem] font-semibold text-button-text">
              + Add
            </span>
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-center gap-1 rounded-lg bg-accent py-2 text-[0.45rem] font-semibold text-button-text shadow-[0_8px_24px_rgba(2,8,135,0.2)]">
        <CartIcon className="h-3 w-3" /> View Cart
        <span className="rounded-full bg-button-text px-1 text-accent">2</span>
      </div>
    </div>
  );
}

function EventPhone() {
  return (
    <div className="mx-auto w-36 rounded-[1.5rem] border-4 border-accent bg-surface p-2 shadow-[0_20px_50px_rgba(2,8,135,0.24)]">
      <ProductSelectionMockup compact={false} />
    </div>
  );
}

function CartPhone() {
  return (
    <div className="mx-auto w-36 rounded-[1.5rem] border-4 border-accent bg-surface p-2 shadow-[0_20px_50px_rgba(2,8,135,0.24)]">
      <div className="rounded-[1rem] bg-background px-2 py-5 text-left text-text">
        <p className="text-[0.45rem] font-semibold text-text-muted">Placed today, 21:36</p>
        <div className="mt-2 overflow-hidden rounded-lg bg-accent text-button-text">
          <div className="grid grid-cols-2 divide-x divide-dashed divide-button-text/30 p-2.5">
            <div>
              <p className="text-[0.35rem] uppercase opacity-60">Order ID</p>
              <p className="mt-1 text-xs font-bold">A14</p>
            </div>
            <div className="text-right">
              <p className="text-[0.35rem] uppercase opacity-60">Pickup code</p>
              <p className="mt-1 text-xs font-bold">4821</p>
            </div>
          </div>
        </div>
        <div className="mt-2 rounded-lg border border-border bg-surface p-2.5 shadow-sm">
          <div className="flex justify-between gap-2">
            <p className="text-[0.5rem] font-semibold">Preparing your order...</p>
            <p className="text-[0.42rem] text-text-muted">1 / 2 ready</p>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-muted">
            <div className="h-full w-1/2 rounded-full bg-accent" />
          </div>
        </div>
      </div>
    </div>
  );
}

function QueuePanel() {
  const columns = [
    ['To Do', ['Smash Burger', 'Loaded Fries']],
    ['In Progress', ['Lemonade']],
    ['Ready', ['Veggie Burger']],
  ] as const;

  return (
    <div className="mx-auto w-72 rotate-1 rounded-xl border border-border bg-background p-3 text-left text-text shadow-[0_20px_50px_rgba(2,8,135,0.2)]">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[0.55rem] font-bold">Burger stand</p>
        <span className="text-[0.4rem] font-semibold text-success">● Live</span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {columns.map(([title, items]) => (
          <div className="rounded-md border border-border bg-surface p-1.5" key={title}>
            <div className="flex items-center justify-between rounded bg-surface-muted p-1.5">
              <p className="text-[0.38rem] font-semibold uppercase">{title}</p>
              <span className="rounded-full bg-surface px-1 text-[0.35rem] text-text-muted">
                {items.length}
              </span>
            </div>
            <div className="mt-1.5 space-y-1.5">
              {items.map((item, index) => (
                <div
                  className="rounded border border-border border-l-[3px] border-l-accent bg-surface p-1.5 shadow-sm"
                  key={item}
                >
                  <p className="truncate text-[0.4rem] font-bold">{item}</p>
                  <p className="mt-1 text-[0.35rem] text-text-muted">#A{14 + index}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PickupPanel() {
  return (
    <div className="mx-auto w-72 -rotate-1 rounded-xl border border-border bg-surface p-3 text-left text-text shadow-[0_20px_50px_rgba(2,8,135,0.2)]">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold">Burger stand</p>
        <span className="rounded border border-border bg-surface px-2 py-1 text-[0.4rem]">
          All Stands
        </span>
      </div>
      <div className="mt-3 grid grid-cols-[1.15fr_1px_0.85fr] gap-2">
        <div>
          <p className="text-[0.42rem] font-bold uppercase tracking-wide text-text-muted">
            In Line
          </p>
          <div className="mt-2 grid grid-cols-2 gap-1.5">
            {['A12', 'A13'].map((order) => (
              <div className="rounded border border-border bg-background p-2" key={order}>
                <p className="text-[0.35rem] font-semibold">Burger</p>
                <p className="mt-2 text-sm font-extrabold">#{order}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-border" />
        <div>
          <p className="text-[0.42rem] font-bold uppercase tracking-wide text-success">
            Ready for Pickup
          </p>
          <div className="mt-2 rounded border border-success/40 bg-background p-2 ring-1 ring-success/10">
            <p className="text-[0.35rem] font-semibold">Loaded Fries</p>
            <p className="mt-2 text-sm font-extrabold">#B04</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function PaymentFlowShowcase() {
  return (
    <div className="landing-payment-stage relative mx-auto mt-14 max-w-5xl overflow-hidden rounded-[2rem] border border-accent/15 bg-accent px-5 py-8 text-left text-button-text shadow-[0_35px_90px_rgba(2,8,135,0.25)] sm:px-10 sm:py-10">
      <div className="landing-payment-grid pointer-events-none absolute inset-0" />

      <div className="relative flex items-center justify-between gap-4">
        <div>
          <p className="landing-eyebrow text-button-text/55">Live payment routing</p>
          <p className="mt-2 text-lg font-black sm:text-2xl">One event. Two ways to pay.</p>
        </div>
        <span className="hidden items-center gap-2 rounded-full border border-button-text/15 bg-button-text/10 px-3 py-2 text-xs font-semibold sm:inline-flex">
          <i className="h-2 w-2 animate-pulse rounded-full bg-button-text" /> Accepting orders
        </span>
      </div>

      <div className="relative mt-9 grid grid-cols-2 gap-3 sm:gap-6">
        <article className="relative z-10 rounded-2xl border border-button-text/15 bg-button-text/10 p-4 backdrop-blur sm:p-6">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-button-text text-accent">
            <CreditCardIcon className="h-5 w-5" />
          </span>
          <p className="mt-6 text-xs font-black uppercase tracking-[0.14em] text-button-text/55">
            Pay online
          </p>
          <p className="mt-1 text-lg font-black sm:text-2xl">Card payment</p>
          <p className="mt-2 hidden text-sm leading-relaxed text-button-text/60 sm:block">
            Guests pay directly while placing the order.
          </p>
        </article>

        <article className="relative z-10 rounded-2xl border border-button-text/15 bg-button-text/10 p-4 backdrop-blur sm:p-6">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-button-text text-accent">
            <CashierIcon className="h-5 w-5" />
          </span>
          <p className="mt-6 text-xs font-black uppercase tracking-[0.14em] text-button-text/55">
            Pay on site
          </p>
          <p className="mt-1 text-lg font-black sm:text-2xl">Cashier payment</p>
          <p className="mt-2 hidden text-sm leading-relaxed text-button-text/60 sm:block">
            Cash orders are confirmed at the event cashier.
          </p>
        </article>

        <div
          aria-hidden="true"
          className="landing-payment-routes pointer-events-none absolute inset-x-0 top-full h-32"
        >
          <svg className="h-full w-full" preserveAspectRatio="none" viewBox="0 0 600 128">
            <path
              d="M145 0 C145 68 300 48 300 124"
              fill="none"
              stroke="currentColor"
              strokeDasharray="5 8"
              strokeWidth="2"
            />
            <path
              d="M455 0 C455 68 300 48 300 124"
              fill="none"
              stroke="currentColor"
              strokeDasharray="5 8"
              strokeWidth="2"
            />
          </svg>
          <span className="landing-payment-dot landing-payment-dot-card" />
          <span className="landing-payment-dot landing-payment-dot-cash" />
        </div>
      </div>

      <div className="relative z-10 mx-auto mt-28 max-w-md rounded-2xl border border-border bg-surface p-4 text-text shadow-[0_24px_60px_rgba(0,0,0,0.24)] sm:p-5">
        <div className="flex items-center gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-success/10 text-success">
            <CheckCircleIcon className="h-6 w-6" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-3">
              <p className="font-bold">Order #A14</p>
              <span className="rounded-full bg-success/10 px-2.5 py-1 text-xs font-semibold text-success">
                Paid
              </span>
            </div>
            <p className="mt-1 text-sm text-text-muted">Burger stand · 2 items</p>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-2 border-t border-border pt-3 text-xs font-semibold text-accent">
          <span className="h-2 w-2 rounded-full bg-accent" /> Sent to the same operator queue
        </div>
      </div>
    </div>
  );
}

function FeatureDashboard() {
  return (
    <WindowShell className="w-full">
      <div className="bg-background p-4 text-text sm:p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold sm:text-base">Live orders</p>
            <p className="mt-1 text-[0.5rem] text-text-muted">
              Manage open paid orders across every stand.
            </p>
          </div>
          <span className="rounded-full border border-accent bg-accent px-3 py-1 text-[0.5rem] font-semibold text-button-text">
            All stands
          </span>
        </div>
        <div className="mt-4 overflow-hidden rounded-lg border border-border bg-surface shadow-sm">
          <div className="grid grid-cols-[0.55fr_1fr_0.8fr_0.6fr] gap-2 border-b border-border bg-surface-muted px-3 py-2 text-[0.45rem] font-semibold uppercase tracking-wide text-text-muted">
            <span>Order</span>
            <span>Stand</span>
            <span>Status</span>
            <span>Total</span>
          </div>
          {[
            ['#A14', 'Burger stand', 'Preparing', '€15.50'],
            ['#A15', 'Main bar', 'Paid', '€12.00'],
            ['#A16', 'Pizza stand', 'Ready', '€9.50'],
            ['#B04', 'Burger stand', 'Preparing', '€18.00'],
          ].map(([order, stand, state, total]) => (
            <div
              className="grid grid-cols-[0.55fr_1fr_0.8fr_0.6fr] gap-2 border-b border-border px-3 py-2.5 text-[0.48rem] last:border-0 sm:text-[0.58rem]"
              key={order}
            >
              <span className="font-bold">{order}</span>
              <span className="truncate text-text-muted">{stand}</span>
              <span
                className={
                  state === 'Ready' ? 'font-semibold text-success' : 'font-semibold text-accent'
                }
              >
                {state}
              </span>
              <span className="font-semibold">{total}</span>
            </div>
          ))}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          {['Stock management', 'Operational pausing'].map((title) => (
            <div className="rounded-lg border border-border bg-surface p-3 shadow-sm" key={title}>
              <p className="text-[0.55rem] font-bold">{title}</p>
              <div className="mt-3 h-2 rounded bg-surface-muted">
                <div className="h-full w-2/3 rounded bg-accent" />
              </div>
              <p className="mt-2 text-[0.45rem] text-text-muted">Burger stand</p>
            </div>
          ))}
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
              <h1 className="landing-display mt-6 max-w-3xl text-[clamp(3.5rem,7.7vw,7.2rem)] leading-[0.83] text-text">
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
        <section className="bg-accent px-6 py-24 text-button-text sm:py-32">
          <div className="mx-auto max-w-7xl">
            <p className="landing-eyebrow text-white/50">The queue costs more than time</p>
            <h2 className="landing-display mt-4 max-w-5xl text-[clamp(3.2rem,7vw,6.5rem)] leading-[0.86]">
              YOUR BEST MOMENTS
              <br />
              SHOULDN&apos;T HAPPEN
              <br />
              <span className="text-button-text/65">IN A LINE.</span>
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

        <section className="px-6 py-24 text-center sm:py-32">
          <div className="mx-auto max-w-5xl">
            <p className="landing-eyebrow text-accent">Flexible at checkout. Unified in service.</p>
            <h2 className="landing-display mt-4 text-[clamp(3.4rem,7.5vw,7rem)] leading-[0.84] text-text">
              CARD OR CASH.
              <br />
              <span className="text-accent">ONE LIVE QUEUE.</span>
            </h2>
            <p className="mx-auto mt-7 max-w-2xl text-lg leading-relaxed text-text-muted">
              Let guests choose how they pay without splitting your operation. Every confirmed order
              reaches the same team, the same queue and the same live overview.
            </p>
          </div>
          <PaymentFlowShowcase />
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
                <h2 className="landing-display mt-4 text-[clamp(3rem,5.5vw,5.5rem)] leading-[0.86] text-text">
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
                  className="absolute -inset-5 rotate-2 rounded-[2rem] bg-accent-soft"
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
          <div className="mx-auto max-w-7xl overflow-hidden rounded-[2.5rem] bg-accent text-button-text shadow-[0_35px_100px_rgba(2,8,135,0.22)]">
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
                  Create and prepare your event without a monthly software bill. Pay-per-use begins
                  when your event goes live.
                </p>
              </div>
              <div className="relative rounded-3xl bg-surface p-7 text-text sm:p-9">
                <div className="absolute right-6 top-0 -translate-y-1/2 rotate-2 rounded-full bg-accent-soft px-4 py-2 text-xs font-black uppercase tracking-wider text-accent">
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
