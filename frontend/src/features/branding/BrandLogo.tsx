import { Wordmark } from '@/components/shared';

type BrandLogoProps = {
  // Cache-busted URL of the event's custom logo, or null to fall back to the
  // text Wordmark. Build it with eventLogoSrc(event) so a replaced logo doesn't
  // keep showing the stale cached image.
  logoSrc: string | null;
};

// Renders an event's custom uploaded logo in a reserved box matching the default
// Wordmark footprint (h-8 ≈ text-2xl line height). A smaller image is left-
// aligned; a larger/taller one scales down proportionally (object-contain) to
// fit entirely with no crop or distortion. Falls back to the Wordmark when no
// custom logo is set.
export function BrandLogo({ logoSrc }: BrandLogoProps) {
  if (!logoSrc) return <Wordmark className="text-2xl text-accent-contrast" />;

  return (
    <span className="flex h-8 max-w-full items-center justify-start overflow-hidden">
      <img src={logoSrc} alt="Event logo" className="max-h-full max-w-full object-contain" />
    </span>
  );
}
