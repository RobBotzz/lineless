import {
  CalendarIcon,
  CheckCircleIcon,
  ImageIcon,
  LinkIcon,
  PinIcon,
  ProductsIcon,
  SettingsIcon,
  StandIcon,
} from '../../components/icons';
import { WindowShell } from './LandingPrimitives';

const configurationAreas = [
  { label: 'Event details', icon: SettingsIcon },
  { label: 'Branding', icon: ImageIcon },
  { label: 'Stands & products', icon: StandIcon },
  { label: 'Links', icon: LinkIcon },
] as const;

function EventConfigurationMockup() {
  return (
    <WindowShell className="relative w-full">
      <div className="bg-background p-3 text-left text-text sm:p-5">
        <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-surface px-3 py-2.5 shadow-sm">
          <div className="min-w-0">
            <p className="truncate text-[0.6rem] font-bold sm:text-xs">Summer Nights Festival</p>
            <p className="mt-0.5 text-[0.42rem] text-text-muted sm:text-[0.5rem]">
              Event Configuration
            </p>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border bg-surface-muted px-2 py-1 text-[0.42rem] font-semibold text-text-muted sm:text-[0.5rem]">
            <i className="h-1.5 w-1.5 rounded-full bg-text-muted" /> Draft
          </span>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-[8.5rem_minmax(0,1fr)]">
          <aside className="hidden rounded-lg border border-border bg-surface p-2 shadow-sm sm:block">
            <p className="px-2 py-1 text-[0.42rem] font-bold uppercase tracking-[0.16em] text-text-muted">
              Configure
            </p>
            <div className="mt-1 space-y-1">
              {configurationAreas.map(({ label, icon: Icon }, index) => (
                <div
                  className={`flex items-center gap-2 rounded-md px-2 py-2 text-[0.5rem] font-semibold ${
                    index === 2 ? 'bg-accent text-button-text' : 'text-text-muted'
                  }`}
                  key={label}
                >
                  <Icon className="h-3 w-3" />
                  {label}
                </div>
              ))}
            </div>
            <div className="mt-3 rounded-md bg-success/5 px-2 py-2 text-[0.45rem] font-semibold text-success">
              <span className="flex items-center gap-1">
                <CheckCircleIcon className="h-3 w-3" /> Auto-saved
              </span>
            </div>
          </aside>

          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg border border-border bg-surface p-2.5 shadow-sm">
                <span className="flex items-center gap-1 text-[0.42rem] font-semibold text-text-muted">
                  <CalendarIcon className="h-3 w-3" /> Event date
                </span>
                <p className="mt-1.5 text-[0.55rem] font-bold sm:text-[0.65rem]">18 July 2026</p>
              </div>
              <div className="rounded-lg border border-border bg-surface p-2.5 shadow-sm">
                <span className="flex items-center gap-1 text-[0.42rem] font-semibold text-text-muted">
                  <PinIcon className="h-3 w-3" /> Location
                </span>
                <p className="mt-1.5 truncate text-[0.55rem] font-bold sm:text-[0.65rem]">
                  Riverside Park
                </p>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-surface p-3 shadow-sm">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-[0.58rem] font-bold sm:text-[0.7rem]">Stands &amp; Products</p>
                  <p className="mt-0.5 text-[0.42rem] text-text-muted">3 stands · 14 products</p>
                </div>
                <span className="rounded bg-accent px-2 py-1 text-[0.42rem] font-semibold text-button-text">
                  + Add stand
                </span>
              </div>
              <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
                {[
                  ['Burger stand', '6 products', 'Smash Burger · Loaded Fries'],
                  ['Main bar', '5 products', 'Lemonade · Craft Beer'],
                ].map(([stand, count, products]) => (
                  <div className="rounded-md border border-border bg-background p-2" key={stand}>
                    <div className="flex items-center justify-between gap-1">
                      <span className="flex min-w-0 items-center gap-1 text-[0.5rem] font-bold">
                        <StandIcon className="h-3 w-3 shrink-0 text-accent" />
                        <span className="truncate">{stand}</span>
                      </span>
                      <span className="shrink-0 text-[0.38rem] text-text-muted">{count}</span>
                    </div>
                    <p className="mt-2 truncate text-[0.42rem] text-text-muted">{products}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border bg-surface px-3 py-2.5 shadow-sm">
              <div className="flex min-w-0 items-center gap-2">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-accent-soft text-accent">
                  <ImageIcon className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0">
                  <p className="text-[0.5rem] font-bold">Your event, your brand</p>
                  <p className="mt-0.5 truncate text-[0.4rem] text-text-muted">
                    Logo and colors previewed live
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 gap-1">
                <i className="h-4 w-4 rounded-full bg-accent" />
                <i className="h-4 w-4 rounded-full border border-border bg-white" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </WindowShell>
  );
}

export function EventConfigurationSection() {
  return (
    <section className="relative overflow-hidden px-6 py-24 sm:py-36">
      <div aria-hidden="true" className="landing-grid absolute inset-0 opacity-80" />
      <div className="relative mx-auto max-w-[calc(80rem-3rem)]">
        <div className="grid items-center gap-14 lg:grid-cols-[0.78fr_1.22fr] lg:gap-20">
          <div>
            <span className="landing-icon-badge">
              <SettingsIcon className="h-5 w-5" />
            </span>
            <p className="landing-eyebrow mt-6 text-accent">Before the gates open</p>
            <h2 className="landing-display mt-4 text-[clamp(3rem,5.5vw,5.6rem)] leading-[0.86] text-text">
              BUILD YOUR
              <br />
              EVENT.
              <br />
              <span className="text-accent">ONCE.</span>
            </h2>
            <p className="mt-6 max-w-lg text-base leading-relaxed text-text-muted">
              Turn the way your event already works into one clear setup. Configure every service
              point, shape the guest experience and share the right access before the first order
              arrives.
            </p>
            <div className="mt-8 grid max-w-lg grid-cols-2 gap-x-5 gap-y-4 text-sm font-bold text-text">
              {[
                [<CalendarIcon className="h-4 w-4" />, 'Event details & location'],
                [<ImageIcon className="h-4 w-4" />, 'Branding &  colors'],
                [<ProductsIcon className="h-4 w-4" />, 'Stands, menus & stock'],
                [<LinkIcon className="h-4 w-4" />, 'QR code & team access'],
              ].map(([icon, label]) => (
                <div className="flex items-center gap-2.5" key={String(label)}>
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent">
                    {icon}
                  </span>
                  <span>{label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="relative pb-10 pt-4 sm:px-4">
            <div
              aria-hidden="true"
              className="absolute inset-x-0 bottom-5 top-0 rotate-2 rounded-[2rem] bg-accent-soft"
            />
            <div className="relative -rotate-1">
              <EventConfigurationMockup />
            </div>
            <div className="landing-float-fast absolute bottom-0 right-0 flex max-w-[12rem] items-center gap-2 rounded-2xl border border-border bg-surface p-3 text-left shadow-[0_18px_50px_rgba(2,8,135,0.18)] sm:right-7 sm:max-w-none">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-success/10 text-success">
                <CheckCircleIcon className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs font-bold text-text">Ready to go live</p>
                <p className="mt-0.5 text-[0.65rem] text-text-muted">Setup complete</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
