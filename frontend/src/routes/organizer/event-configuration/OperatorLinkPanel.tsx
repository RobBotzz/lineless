import { paths } from '@/paths';

import { CopyLinkField } from './CopyLinkField';

function operatorLink(eventId: string, operatorAccessKey: string) {
  return `${window.location.origin}${paths.operator.link(eventId, operatorAccessKey)}`;
}

export function OperatorLinkPanel({
  eventId,
  operatorAccessKey,
}: {
  eventId: string;
  operatorAccessKey: string;
}) {
  return (
    // Flush to the trigger button above (no top corners / border).
    <div className="bg-card space-y-4 rounded-b-lg border border-t-0 p-4">
      <p className="text-text-muted text-sm">
        Share this with stand operators. The link opens stand selection — keep it private.
      </p>
      <CopyLinkField link={operatorLink(eventId, operatorAccessKey)} />
    </div>
  );
}
