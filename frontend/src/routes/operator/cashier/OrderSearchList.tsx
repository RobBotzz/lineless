import type { ReactNode } from 'react';

import { SearchIcon } from '@/components/icons';
import { BackButton } from '@/components/shared';

interface OrderSearchListProps<T> {
  backTo: string;
  backLabel: string;
  title: string;
  subtitle: string;
  query: string;
  onQueryChange: (value: string) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  searchInputId: string;
  searchError: string | null;
  // The already-filtered items; null means there's nothing to list yet
  // (loading/error/gated) and `renderState` is shown instead.
  items: T[] | null;
  renderState?: ReactNode;
  gridColsClassName: string;
  getItemKey: (item: T) => string;
  onItemClick: (item: T) => void;
  renderCard: (item: T) => ReactNode;
  renderItemAction?: (item: T) => ReactNode;
  children?: ReactNode;
}

// Shared "search + list" shell for the cashier's order-search screens (cash
// payment, cash refund). Owns only the chrome and layout the two screens have
// in common; data fetching (live stream vs. one-shot), extra loading/error
// states, and per-card actions stay with the caller via props/slots.
export function OrderSearchList<T>({
  backTo,
  backLabel,
  title,
  subtitle,
  query,
  onQueryChange,
  onSubmit,
  searchInputId,
  searchError,
  items,
  renderState,
  gridColsClassName,
  getItemKey,
  onItemClick,
  renderCard,
  renderItemAction,
  children,
}: OrderSearchListProps<T>) {
  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <BackButton to={backTo}>{backLabel}</BackButton>

      <section className="mt-6 rounded-xl border border-border bg-surface p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-text">{title}</h2>
            <p className="mt-1 text-sm text-text-muted">{subtitle}</p>
          </div>
          <form onSubmit={onSubmit} className="sm:w-72">
            <label htmlFor={searchInputId} className="sr-only">
              Search by order number
            </label>
            <div className="relative">
              <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
              <input
                id={searchInputId}
                value={query}
                onChange={(event) => onQueryChange(event.target.value)}
                placeholder="Search order no. (e.g. A001)"
                className="h-11 w-full rounded-md border border-border bg-surface pl-9 pr-3 text-sm text-text outline-none transition-colors placeholder:text-text-muted focus:border-accent"
              />
            </div>
          </form>
        </div>

        {searchError ? <p className="mt-3 text-sm text-danger">{searchError}</p> : null}

        <div className="mt-4">
          {items === null || items.length === 0 ? (
            renderState
          ) : (
            <ul className={`grid gap-3 ${gridColsClassName}`}>
              {items.map((item) => (
                <li key={getItemKey(item)} className="relative">
                  <button
                    type="button"
                    onClick={() => onItemClick(item)}
                    className="flex h-full w-full flex-col rounded-lg border border-border bg-surface p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  >
                    {renderCard(item)}
                  </button>
                  {renderItemAction?.(item)}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {children}
    </div>
  );
}
