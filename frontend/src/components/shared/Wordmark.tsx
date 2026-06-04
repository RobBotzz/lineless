type WordmarkProps = {
  className?: string;
  underline?: boolean;
};

// The "lineless" wordmark. Renders only the text — wrap it in a Link or add an
// aria-label at the call site, since those differ per context.
export function Wordmark({ className = 'text-2xl', underline = true }: WordmarkProps) {
  return (
    <span className={`font-logo text-accent ${className}`}>
      {underline ? (
        <span className="underline decoration-current decoration-2 underline-offset-4">line</span>
      ) : (
        'line'
      )}
      less
    </span>
  );
}
