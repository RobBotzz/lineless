import { StarRating } from '@/components/shared';

interface ProductReviewCardProps {
  productName: string;
  standName: string;
  stars: number;
  comment: string;
  onStarsChange: (stars: number) => void;
  onCommentChange: (comment: string) => void;
}

export function ProductReviewCard({
  productName,
  standName,
  stars,
  comment,
  onStarsChange,
  onCommentChange,
}: ProductReviewCardProps) {
  return (
    <div className="space-y-3 rounded-xl border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-semibold text-text">{productName}</p>
          <p className="text-sm text-text-muted">{standName}</p>
        </div>
        <span className="shrink-0 text-sm text-text-muted">{stars > 0 ? stars : '—'}/5</span>
      </div>

      <StarRating value={stars} onChange={onStarsChange} />

      <textarea
        className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-text placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        rows={3}
        maxLength={500}
        placeholder="Leave a comment (optional)"
        value={comment}
        onChange={(e) => onCommentChange(e.target.value)}
      />
    </div>
  );
}
