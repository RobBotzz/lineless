import type { SVGProps } from 'react';

// Small icon set for the attendee area. Inline SVGs keep the bundle lean and
// inherit `currentColor`, so they pick up the surrounding text color.
type IconProps = SVGProps<SVGSVGElement>;

const base = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  viewBox: '0 0 24 24',
};

export function CartIcon({ className = 'h-5 w-5', ...props }: IconProps) {
  return (
    <svg className={className} {...base} {...props}>
      <circle cx="9" cy="20" r="1.4" />
      <circle cx="18" cy="20" r="1.4" />
      <path d="M2.5 3h2l2.2 11.2a1.5 1.5 0 0 0 1.5 1.2h8.4a1.5 1.5 0 0 0 1.5-1.2L21 7H6" />
    </svg>
  );
}

export function HistoryIcon({ className = 'h-5 w-5', ...props }: IconProps) {
  return (
    <svg className={className} {...base} {...props}>
      <path d="M3 4v5h5" />
      <path d="M3.5 9a9 9 0 1 1-1 4.5" />
      <path d="M12 8v4l3 2" />
    </svg>
  );
}

export function PlusIcon({ className = 'h-4 w-4', ...props }: IconProps) {
  return (
    <svg className={className} {...base} {...props}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function MinusIcon({ className = 'h-4 w-4', ...props }: IconProps) {
  return (
    <svg className={className} {...base} {...props}>
      <path d="M5 12h14" />
    </svg>
  );
}

export function TrashIcon({ className = 'h-4 w-4', ...props }: IconProps) {
  return (
    <svg className={className} {...base} {...props}>
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M6 6l1 14a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-14" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}

export function ChatIcon({ className = 'h-4 w-4', ...props }: IconProps) {
  return (
    <svg className={className} {...base} {...props}>
      <path d="M4 5h16a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H9l-4 4v-4H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z" />
    </svg>
  );
}

export function ChevronDownIcon({ className = 'h-4 w-4', ...props }: IconProps) {
  return (
    <svg className={className} {...base} {...props}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

export function InfoIcon({ className = 'h-4 w-4', ...props }: IconProps) {
  return (
    <svg className={className} {...base} {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5" />
      <path d="M12 7.5h.01" />
    </svg>
  );
}

export function StarIcon({
  className = 'h-3.5 w-3.5',
  filled = true,
  ...props
}: IconProps & { filled?: boolean }) {
  return (
    <svg
      className={className}
      fill={filled ? 'currentColor' : 'none'}
      stroke={filled ? 'none' : 'currentColor'}
      strokeWidth={filled ? undefined : 1.8}
      strokeLinejoin="round"
      viewBox="0 0 24 24"
      aria-hidden="true"
      {...props}
    >
      <path d="M12 2.5l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.8 6.2 20.9l1.1-6.5L2.6 9.8l6.5-.9L12 2.5z" />
    </svg>
  );
}

export function ImageIcon({ className = 'h-6 w-6', ...props }: IconProps) {
  return (
    <svg className={className} {...base} {...props}>
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="M21 15l-5-5L5 21" />
    </svg>
  );
}
