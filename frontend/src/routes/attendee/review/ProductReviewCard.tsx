import { StarRating } from '@/components/shared';

interface ProductReviewCardProps {
  productName: string;
  standName: string;
  stars: number;
  comment: string;
  onStarsChange: (stars: number) => void;
  onCommentChange: (comment: string) => void;
  disabled?: boolean;
}

export function ProductReviewCard({
  productName,
  standName,
  stars,
  comment,
  onStarsChange,
  onCommentChange,
  disabled,
}: ProductReviewCardProps) {
  return (
    <div className="space-y-3 rounded-xl border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-text">{productName}</p>
          {disabled && <p className="text-xs text-text-muted">Already reviewed</p>}
        </div>
        <span className="shrink-0 text-sm text-text-muted">{standName}</span>
      </div>

      <StarRating value={stars} onChange={onStarsChange} readOnly={disabled} />

      <textarea
        className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-text placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-60"
        rows={3}
        maxLength={500}
        placeholder="Leave a comment (optional)"
        value={comment}
        disabled={disabled}
        onChange={(e) => onCommentChange(e.target.value)}
      />
    </div>
  );
}
