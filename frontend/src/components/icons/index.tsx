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

export function CreditCardIcon({ className = 'h-6 w-6' }: IconProps) {
  return (
    <svg className={className} {...strokeProps}>
      <rect height="14" rx="2" width="20" x="2" y="5" />
      <path d="M2 10h20" />
    </svg>
  );
}
