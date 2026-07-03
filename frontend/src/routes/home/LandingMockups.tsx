import { CartIcon, ProductsIcon } from '../../components/icons';
import { WindowShell } from './LandingPrimitives';

function ProductSelectionMockup({ compact = true }: { compact?: boolean }) {
  return (
    <div
      className={`overflow-hidden rounded-[1.25rem] bg-background pb-3 pt-5 text-text ${compact ? 'px-2' : 'px-3'}`}
    >
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
            className="grid grid-cols-[2rem_minmax(0,1fr)_auto] items-center gap-2 rounded-lg border border-border bg-surface p-2 shadow-sm"
            key={name}
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-surface-muted text-accent">
              <ProductsIcon className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[0.5rem] font-semibold">{name}</p>
              <p className="mt-1 text-[0.45rem] font-semibold">{price}</p>
            </div>
            <span className="whitespace-nowrap rounded bg-accent px-1.5 py-1 text-[0.4rem] font-semibold text-button-text">
              {compact ? '+' : '+ Add'}
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

export function HeroDashboard() {
  return (
    <div className="landing-hero-visual relative mx-auto min-h-[31rem] w-full max-w-[38rem] sm:min-h-[36rem]">
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

export function EventPhone() {
  return (
    <div className="mx-auto w-48 rounded-[1.75rem] border-4 border-accent bg-surface p-2 shadow-[0_20px_50px_rgba(2,8,135,0.24)]">
      <ProductSelectionMockup compact={false} />
    </div>
  );
}

export function CartPhone() {
  return (
    <div className="mx-auto w-48 rounded-[1.75rem] border-4 border-accent bg-surface p-2 shadow-[0_20px_50px_rgba(2,8,135,0.24)]">
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

export function QueuePanel() {
  const columns = [
    ['To Do', ['Smash Burger', 'Loaded Fries']],
    ['In Progress', ['Lemonade']],
    ['Ready', ['Veggie Burger']],
  ] as const;

  return (
    <div className="mx-auto w-full max-w-[22rem] rotate-1 rounded-xl border border-border bg-background p-3 text-left text-text shadow-[0_20px_50px_rgba(2,8,135,0.2)]">
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

export function PickupPanel() {
  return (
    <div className="mx-auto w-full max-w-[22rem] -rotate-1 rounded-xl border border-border bg-surface p-3 text-left text-text shadow-[0_20px_50px_rgba(2,8,135,0.2)]">
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

export function FeatureDashboard() {
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
