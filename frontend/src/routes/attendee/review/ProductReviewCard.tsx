import { StarRating } from '@/components/shared';
import { CheckCircleIcon } from '@/components/icons';

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
  const trimmedComment = comment.trim();

  return (
    <div className="space-y-3 rounded-xl border border-border bg-surface p-4">
      <div className="min-w-0">
        <p className="font-semibold text-text [overflow-wrap:anywhere]">{productName}</p>
        <span className="mt-0.5 block text-sm text-text-muted [overflow-wrap:anywhere]">
          {standName}
        </span>
        {disabled && (
          <p className="mt-0.5 flex items-center gap-1 text-xs font-medium text-green-600">
            <CheckCircleIcon className="h-3.5 w-3.5" />
            Reviewed
          </p>
        )}
      </div>

      <StarRating value={stars} onChange={onStarsChange} readOnly={disabled} />

      {disabled ? (
        // Already reviewed: render the comment read-only, sized to its actual text.
        trimmedComment ? (
          <p className="whitespace-pre-wrap rounded-lg border border-border bg-background px-3 py-2 text-sm text-text [overflow-wrap:anywhere]">
            {trimmedComment}
          </p>
        ) : null
      ) : (
        <textarea
          className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm text-text placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          rows={3}
          maxLength={500}
          placeholder="Leave a comment (optional)"
          value={comment}
          onChange={(e) => onCommentChange(e.target.value)}
        />
      )}
    </div>
  );
}
