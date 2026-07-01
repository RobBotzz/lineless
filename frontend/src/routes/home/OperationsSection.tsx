import {
  CheckCircleIcon,
  CreditCardIcon,
  DashboardIcon,
  PickupIcon,
  StandIcon,
} from '../../components/icons';
import { FeatureDashboard } from './LandingMockups';

export function OperationsSection() {
  return (
    <section className="px-6 py-24 sm:py-36">
      <div className="mx-auto max-w-[calc(80rem-3rem)]">
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
              Live orders, stand health, stock signals and revenue come together in one operational
              view, so your team can act while it still matters.
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
  );
}
