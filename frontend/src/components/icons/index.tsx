// Shared inline SVG icons. Each takes an optional className so callers control
// sizing/color (inherits currentColor). Defaults match each icon's most common
// use; pass className to override size or add utilities (e.g. shrink-0).
type IconProps = { className?: string };

// Shared <svg> attributes for the stroke-based icons below.
const strokeProps = {
  'aria-hidden': true,
  fill: 'none',
  stroke: 'currentColor',
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  strokeWidth: 2,
  viewBox: '0 0 24 24',
} as const;

export function ProductsIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg className={className} {...strokeProps}>
      <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
      <path d="M3.3 7 12 12l8.7-5" />
      <path d="M12 22V12" />
    </svg>
  );
}

export function StandIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg className={className} {...strokeProps}>
      <path d="M3 9 4.5 4h15L21 9" />
      <path d="M4 9v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9" />
      <path d="M3 9h18" />
      <path d="M9 20v-5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v5" />
    </svg>
  );
}

export function PickupIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg className={className} {...strokeProps}>
      <path d="M6 7h12l-1 14H7L6 7Z" />
      <path d="M9 7a3 3 0 0 1 6 0" />
      <path d="M9 12h6" />
      <path d="M10.5 16h3" />
    </svg>
  );
}

export function CashierIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg className={className} {...strokeProps}>
      <rect height="10" rx="2" width="18" x="3" y="10" />
      <path d="M7 10V7a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v3" />
      <path d="M7 14h.01" />
      <path d="M11 14h.01" />
      <path d="M15 14h2" />
      <path d="M7 18h10" />
    </svg>
  );
}

export function LockIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg className={className} {...strokeProps}>
      <rect height="11" rx="2" width="16" x="4" y="11" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

export function UnlockIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg className={className} {...strokeProps}>
      <rect height="11" rx="2" width="16" x="4" y="11" />
      <path d="M8 11V7a4 4 0 0 1 7.5-2" />
    </svg>
  );
}

export function PinIcon({ className = 'h-5 w-5' }: IconProps) {
  return (
    <svg className={className} {...strokeProps}>
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

export function ChevronDownIcon({ className }: IconProps) {
  return (
    <svg className={['h-4 w-4', className].filter(Boolean).join(' ')} {...strokeProps}>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export function ChevronRightIcon({ className }: IconProps) {
  return (
    <svg className={['h-4 w-4', className].filter(Boolean).join(' ')} {...strokeProps}>
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

export function EditIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg className={className} {...strokeProps}>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

export function DeleteIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg className={className} {...strokeProps}>
      <path d="M3 6h18" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </svg>
  );
}

export function EyeIcon({ className = 'h-5 w-5' }: IconProps) {
  return (
    <svg className={className} {...strokeProps}>
      <path d="M2 12s4-8 10-8 10 8 10 8-4 8-10 8S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function EyeOffIcon({ className = 'h-5 w-5' }: IconProps) {
  return (
    <svg className={className} {...strokeProps}>
      <path d="m3 3 18 18" />
      <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
      <path d="M9.9 4.2A10.8 10.8 0 0 1 12 4c5 0 9 4.5 10 8a11.8 11.8 0 0 1-2.1 3.6" />
      <path d="M6.6 6.6A12 12 0 0 0 2 12c1 3.5 5 8 10 8a10.8 10.8 0 0 0 4.2-.9" />
    </svg>
  );
}

export function CheckIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg className={className} {...strokeProps}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export function XIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg className={className} {...strokeProps}>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

export function WarningTriangleIcon({ className = 'h-8 w-8' }: IconProps) {
  return (
    <svg className={className} {...strokeProps}>
      <path d="M10.3 4.2 2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  );
}

export function CalendarIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg className={className} {...strokeProps}>
      <rect height="18" rx="2" width="18" x="3" y="4" />
      <path d="M3 10h18M8 2v4M16 2v4" />
    </svg>
  );
}

export function CopyIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg className={className} {...strokeProps}>
      <rect height="13" rx="2" width="13" x="9" y="9" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

export function DownloadIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg className={className} {...strokeProps}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="M7 10l5 5 5-5" />
      <path d="M12 15V3" />
    </svg>
  );
}

export function LinkIcon({ className = 'h-5 w-5' }: IconProps) {
  return (
    <svg className={className} {...strokeProps}>
      <path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

export function UploadIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg className={className} {...strokeProps}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="M17 8l-5-5-5 5" />
      <path d="M12 3v12" />
    </svg>
  );
}

export function ImageIcon({ className = 'h-6 w-6' }: IconProps) {
  return (
    <svg className={className} {...strokeProps}>
      <rect height="18" rx="2" ry="2" width="18" x="3" y="3" />
      <circle cx="9" cy="9" r="2" />
      <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
    </svg>
  );
}

export function CartIcon({ className = 'h-6 w-6' }: IconProps) {
  return (
    <svg className={className} {...strokeProps}>
      <circle cx="9" cy="21" r="1" />
      <circle cx="20" cy="21" r="1" />
      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
    </svg>
  );
}

export function CreditCardIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg className={className} {...strokeProps}>
      <rect height="14" rx="2" width="20" x="2" y="5" />
      <path d="M2 10h20" />
      <path d="M6 15h3" />
    </svg>
  );
}

export function BanknoteIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg className={className} {...strokeProps}>
      <rect height="12" rx="2" width="20" x="2" y="6" />
      <circle cx="12" cy="12" r="2" />
      <path d="M6 12h.01" />
      <path d="M18 12h.01" />
    </svg>
  );
}

export function RefundIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg className={className} {...strokeProps}>
      <path d="M3 9h12a6 6 0 0 1 0 12h-3" />
      <path d="m7 5-4 4 4 4" />
    </svg>
  );
}

export function HistoryIcon({ className = 'h-5 w-5' }: IconProps) {
  return (
    <svg className={className} {...strokeProps}>
      <path d="M3 4v5h5" />
      <path d="M3.5 9a9 9 0 1 1-1 4.5" />
      <path d="M12 8v4l3 2" />
    </svg>
  );
}

export function SettingsIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg className={className} {...strokeProps}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
    </svg>
  );
}

export function PlusIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg className={className} {...strokeProps}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function MinusIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg className={className} {...strokeProps}>
      <path d="M5 12h14" />
    </svg>
  );
}

export function SearchIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg className={className} {...strokeProps}>
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

export function ChatIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg className={className} {...strokeProps}>
      <path d="M4 5h16a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H9l-4 4v-4H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z" />
    </svg>
  );
}

export function PauseIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg className={className} {...strokeProps}>
      <rect height="14" rx="1" width="4" x="6" y="5" />
      <rect height="14" rx="1" width="4" x="14" y="5" />
    </svg>
  );
}

export function PlayIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg className={className} {...strokeProps}>
      <path d="M7 4.5v15l12-7.5z" />
    </svg>
  );
}

export function CheckCircleIcon({ className = 'h-6 w-6' }: IconProps) {
  return (
    <svg className={className} {...strokeProps}>
      <circle cx="12" cy="12" r="9" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

// Hourglass nested in a circle outline — matches CheckCircleIcon's framing so
// the pending-payment banner reads as the same "status icon" family.
export function HourglassCircleIcon({ className = 'h-6 w-6' }: IconProps) {
  return (
    <svg className={className} {...strokeProps}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9 7h6" />
      <path d="M9 17h6" />
      <path d="M9 7c0 2.5 2 3 2 5s-2 2.5-2 5" />
      <path d="M15 7c0 2.5-2 3-2 5s2 2.5 2 5" />
    </svg>
  );
}

export function RefreshIcon({ className = 'h-5 w-5' }: IconProps) {
  return (
    <svg className={className} {...strokeProps}>
      <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
    </svg>
  );
}

// X nested in a circle outline — same "status icon" family as CheckCircleIcon
// and HourglassCircleIcon, for a cancelled/failed state.
export function XCircleIcon({ className = 'h-6 w-6' }: IconProps) {
  return (
    <svg className={className} {...strokeProps}>
      <circle cx="12" cy="12" r="9" />
      <path d="m9.5 9.5 5 5" />
      <path d="m14.5 9.5-5 5" />
    </svg>
  );
}

export function InfoIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg className={className} {...strokeProps}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5" />
      <path d="M12 7.5h.01" />
    </svg>
  );
}

export function CommentIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg className={className} {...strokeProps}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

export function UserIcon({ className = 'h-5 w-5' }: IconProps) {
  return (
    <svg className={className} {...strokeProps}>
      <path d="M19 21a7 7 0 0 0-14 0" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

export function DashboardIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg className={className} {...strokeProps}>
      <rect height="7" rx="1.5" width="7" x="3" y="3" />
      <rect height="7" rx="1.5" width="7" x="14" y="3" />
      <rect height="7" rx="1.5" width="7" x="3" y="14" />
      <rect height="7" rx="1.5" width="7" x="14" y="14" />
    </svg>
  );
}

export function LogOutIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg className={className} {...strokeProps}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  );
}

export function ExternalLinkIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg className={className} {...strokeProps}>
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

export function ArrowRightIcon({ className = 'h-4 w-4' }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      viewBox="0 0 24 24"
    >
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  );
}

export function StarIcon({
  className = 'h-3.5 w-3.5',
  filled = true,
}: IconProps & { filled?: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill={filled ? 'currentColor' : 'none'}
      stroke={filled ? 'none' : 'currentColor'}
      strokeWidth={filled ? undefined : 2}
      strokeLinejoin="round"
      viewBox="0 0 24 24"
    >
      <path d="M12 2.5l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.8 6.2 20.9l1.1-6.5L2.6 9.8l6.5-.9L12 2.5z" />
    </svg>
  );
}
