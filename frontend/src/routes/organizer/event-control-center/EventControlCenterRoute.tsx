import { useParams } from 'react-router';

import EventControlCenter from './EventControlCenter';

export default function EventControlCenterRoute() {
  const { eventId } = useParams();
  return <EventControlCenter key={eventId ?? 'event-control-center'} />;
}
