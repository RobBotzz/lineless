import { useEffect } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';

import { startOperatorSession } from '../../auth/keychain';
import { paths } from '../../paths';

// Secret-link entry point: persist the event link key, then replace the URL so
// the key never lingers in browser history or a Referer header.
export default function OperatorLinkEntry() {
  const { eventId, operatorAccessKey } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    if (!eventId || !operatorAccessKey) return;
    startOperatorSession(eventId, operatorAccessKey);
    navigate(paths.operator.root(eventId), { replace: true });
  }, [eventId, operatorAccessKey, navigate]);

  if (!eventId || !operatorAccessKey) {
    return <Navigate to={paths.home} replace />;
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center text-sm font-medium text-text-muted">
      Opening stand selection…
    </div>
  );
}
