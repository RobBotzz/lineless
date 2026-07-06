import { useState } from 'react';

import { ImageIcon } from '@/components/icons';

interface ProductThumbnailProps {
  imageSrc: string | null | undefined;
  // Real product name — always required so the image stays accessible to
  // screen readers (never pass "").
  alt: string;
  // Sizing + shape for the outer box, e.g. "h-20 w-20 rounded-lg".
  className?: string;
  iconClassName?: string;
  // When set, the thumbnail becomes clickable while a real image is showing
  // (e.g. to open a lightbox). Has no effect while the fallback icon shows.
  onClick?: () => void;
  clickLabel?: string;
}

export function ProductThumbnail({
  imageSrc,
  alt,
  className = 'h-20 w-20 rounded-lg',
  iconClassName,
  onClick,
  clickLabel,
}: ProductThumbnailProps) {
  const [imageOk, setImageOk] = useState(true);
  const showImage = !!imageSrc && imageOk;

  const image = showImage ? (
    <img
      alt={alt}
      className="h-full w-full object-cover"
      onError={() => setImageOk(false)}
      src={imageSrc}
    />
  ) : (
    <div className="flex h-full w-full items-center justify-center text-text-muted">
      <ImageIcon className={iconClassName} />
    </div>
  );

  return (
    <div className={`${className} shrink-0 overflow-hidden border border-border bg-surface-muted`}>
      {showImage && onClick ? (
        <button
          type="button"
          aria-label={clickLabel}
          className="h-full w-full cursor-zoom-in"
          onClick={onClick}
        >
          {image}
        </button>
      ) : (
        image
      )}
    </div>
  );
}
