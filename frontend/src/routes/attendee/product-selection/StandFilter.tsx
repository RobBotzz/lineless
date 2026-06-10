import { useCallback, useEffect, useRef, useState } from 'react';

import type { Stand } from '@/types/stand';

// Sentinel for the "show every stand" chip.
export const ALL_STANDS = 'all';

interface StandFilterProps {
  stands: Stand[];
  selected: string;
  onSelect: (standId: string) => void;
}

export function StandFilter({ stands, selected, onSelect }: StandFilterProps) {
  const chips = [
    { id: ALL_STANDS, label: 'All' },
    ...stands.map((s) => ({ id: s._id, label: s.standName })),
  ];

  // Edge fades hint that the row scrolls — shown only when content overflows
  // in that direction, so the affordance is visible at first glance.
  const scrollRef = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  const recompute = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setEdges({
      left: el.scrollLeft > 1,
      right: el.scrollLeft + el.clientWidth < el.scrollWidth - 1,
    });
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    // ResizeObserver fires once on observe (initial measure) and on resize.
    const ro = new ResizeObserver(recompute);
    ro.observe(el);
    return () => ro.disconnect();
  }, [recompute]);

  return (
    <div className="relative">
      <div
        ref={scrollRef}
        onScroll={recompute}
        className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {chips.map((chip) => {
          const isActive = selected === chip.id;
          return (
            <button
              key={chip.id}
              type="button"
              onClick={() => onSelect(chip.id)}
              className={[
                'shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors',
                isActive
                  ? 'border-accent bg-accent text-[var(--color-button-text)]'
                  : 'border-border bg-surface text-text hover:bg-surface-muted',
              ].join(' ')}
            >
              {chip.label}
            </button>
          );
        })}
      </div>

      {edges.left && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 w-6 bg-linear-to-r from-background to-transparent"
        />
      )}
      {edges.right && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-linear-to-l from-background to-transparent"
        />
      )}
    </div>
  );
}
