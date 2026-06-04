import { useEffect, useRef, useState } from 'react';
import { QRCodeCanvas } from 'qrcode.react';

import { Button } from '@/components/ui/button';
import { CheckIcon, CopyIcon, DownloadIcon } from '@/components/icons';
import { paths } from '@/paths';

function customerLink(eventId: string) {
  return `${window.location.origin}${paths.attendee.event(eventId)}`;
}

export function CustomerLinkPanel({ eventId }: { eventId: string }) {
  const link = customerLink(eventId);
  const qrWrapRef = useRef<HTMLDivElement>(null);
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

  function downloadQr() {
    const canvas = qrWrapRef.current?.querySelector('canvas');
    if (!canvas) return;
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png');
    a.download = `event-${eventId}-qr.png`;
    a.click();
  }

  return (
    // Flush to the trigger button above (no top corners / border).
    <div className="bg-card space-y-4 rounded-b-lg border border-t-0 p-4">
      <div>
        {/* The whole field is the copy trigger; text is non-selectable. */}
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

      <div className="flex flex-col items-center gap-3">
        {/* White padding gives the QR a quiet zone on screen; marginSize bakes it
            into the downloaded PNG too. */}
        <div className="rounded-lg bg-white p-3" ref={qrWrapRef}>
          <QRCodeCanvas level="M" marginSize={2} size={180} value={link} />
        </div>
        <Button onClick={downloadQr} size="sm" type="button" variant="outline">
          <DownloadIcon /> <span className="ml-2">Download QR code</span>
        </Button>
      </div>
    </div>
  );
}
