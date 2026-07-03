import { CashierIcon, CheckCircleIcon, CreditCardIcon } from '../../components/icons';

function PaymentFlowShowcase() {
  return (
    <div className="landing-payment-stage relative mx-auto mt-14 max-w-5xl overflow-hidden rounded-[2rem] border border-border bg-surface px-5 py-6 text-left text-text shadow-[0_30px_80px_rgba(2,8,135,0.1)] sm:px-8 sm:py-8">
      <div className="landing-payment-grid pointer-events-none absolute inset-0" />

      <div className="relative flex items-center justify-between gap-4 border-b border-border pb-5">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-accent">
          Payment routing
        </p>
        <span className="inline-flex items-center gap-2 rounded-full border border-success/20 bg-success/5 px-3 py-1.5 text-xs font-semibold text-success">
          <i className="h-2 w-2 animate-pulse rounded-full bg-success motion-reduce:animate-none" />{' '}
          Live
        </span>
      </div>

      <div className="relative mt-6 grid grid-cols-2 gap-3 sm:gap-5">
        <article className="relative z-10 flex min-w-0 items-center gap-3 rounded-2xl border border-border bg-background p-3 shadow-sm sm:gap-4 sm:p-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent sm:h-12 sm:w-12">
            <CreditCardIcon className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[0.65rem] font-black uppercase tracking-[0.14em] text-text-muted">
              Pay online
            </p>
            <p className="mt-1 truncate text-sm font-bold sm:text-base">Card payment</p>
          </div>
          <span className="hidden rounded-full bg-accent-soft px-2.5 py-1 text-[0.65rem] font-semibold text-accent sm:block">
            Instant
          </span>
        </article>

        <article className="relative z-10 flex min-w-0 items-center gap-3 rounded-2xl border border-border bg-background p-3 shadow-sm sm:gap-4 sm:p-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent sm:h-12 sm:w-12">
            <CashierIcon className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[0.65rem] font-black uppercase tracking-[0.14em] text-text-muted">
              Pay on site
            </p>
            <p className="mt-1 truncate text-sm font-bold sm:text-base">Cash payment</p>
          </div>
          <span className="hidden rounded-full bg-surface-muted px-2.5 py-1 text-[0.65rem] font-semibold text-text-muted sm:block">
            On-site
          </span>
        </article>
      </div>

      <div
        aria-hidden="true"
        className="landing-payment-routes relative mx-auto h-auto w-full max-w-3xl"
      >
        <svg
          className="block h-auto w-full"
          preserveAspectRatio="xMidYMid meet"
          viewBox="0 0 800 260"
        >
          <path
            className="landing-payment-path"
            d="M200 0 C200 92 400 62 400 136"
            fill="none"
            pathLength="1"
            stroke="currentColor"
            strokeWidth="2"
          />
          <path
            className="landing-payment-path"
            d="M600 0 C600 92 400 62 400 136"
            fill="none"
            pathLength="1"
            stroke="currentColor"
            strokeWidth="2"
          />
          <path
            className="landing-payment-path"
            d="M400 136 L400 260"
            fill="none"
            pathLength="1"
            stroke="currentColor"
            strokeWidth="2"
          />
          <circle className="landing-payment-packet" fill="currentColor" r="8">
            <animateMotion
              begin="0s"
              dur="4s"
              path="M200 0 C200 92 400 62 400 136 L400 260"
              repeatCount="indefinite"
            />
          </circle>
          <circle className="landing-payment-packet" fill="currentColor" r="8">
            <animateMotion
              begin="2s"
              dur="4s"
              path="M600 0 C600 92 400 62 400 136 L400 260"
              repeatCount="indefinite"
            />
          </circle>
        </svg>
        <div className="landing-payment-router absolute left-1/2 top-[52%] flex h-20 w-20 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-[6px] border-surface bg-accent text-center text-button-text shadow-[0_14px_35px_rgba(2,8,135,0.3)]">
          <span className="text-[0.55rem] font-black uppercase leading-tight tracking-wider">
            One
            <br /> queue
          </span>
        </div>
      </div>

      <div className="landing-payment-order relative z-10 mx-auto -mt-1 max-w-lg overflow-hidden rounded-2xl border border-border bg-surface text-text shadow-[0_18px_45px_rgba(2,8,135,0.13)]">
        <span className="absolute inset-y-0 left-0 w-1 bg-accent" />
        <div className="flex items-center gap-4 p-4 sm:p-5">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-success/10 text-success">
            <CheckCircleIcon className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
              Sent to Burger stand
            </p>
            <p className="mt-1 font-bold">Order #A14 · 2 items</p>
          </div>
          <span className="rounded-full bg-success/10 px-2.5 py-1 text-xs font-semibold text-success">
            Paid
          </span>
        </div>
      </div>
    </div>
  );
}

export function PaymentSection() {
  return (
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
  );
}
