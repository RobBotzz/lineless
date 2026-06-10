import { useRef } from 'react';
import { QRCodeCanvas } from 'qrcode.react';

import { Button } from '@/components/ui/button';
import { DownloadIcon } from '@/components/icons';
import { paths } from '@/paths';

import { CopyLinkField } from './CopyLinkField';

function customerLink(eventId: string) {
  return `${window.location.origin}${paths.attendee.event(eventId)}`;
}

export function CustomerLinkPanel({ eventId }: { eventId: string }) {
  const link = customerLink(eventId);
  const qrWrapRef = useRef<HTMLDivElement>(null);

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
      <CopyLinkField link={link} />

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
