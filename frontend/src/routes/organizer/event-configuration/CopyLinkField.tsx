import { useEffect, useRef, useState } from 'react';

import { CheckIcon, CopyIcon } from '@/components/icons';

export function CopyLinkField({ link }: { link: string }) {
  const [copied, setCopied] = useState(false);
  const resetTimer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(resetTimer.current), []);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.clearTimeout(resetTimer.current);
      resetTimer.current = window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked (e.g. insecure context); nothing to copy then.
    }
  }

  return (
    <div>
      <button
        aria-label={copied ? 'Link copied' : 'Copy link'}
        className="bg-surface text-text hover:border-accent focus:border-accent focus:ring-accent-soft relative flex w-full items-center rounded-lg border border-border py-3 pr-12 pl-4 text-left text-sm outline-none transition select-none focus:ring-2"
        onClick={copyLink}
        title="Click to copy"
        type="button"
      >
        <span className="truncate">{link}</span>
        <span className="text-text-muted absolute inset-y-0 right-0 flex w-12 items-center justify-center">
          {copied ? <CheckIcon /> : <CopyIcon />}
        </span>
      </button>
      {copied && <p className="text-text-muted mt-1.5 text-xs">Copied to clipboard</p>}
    </div>
  );
}
