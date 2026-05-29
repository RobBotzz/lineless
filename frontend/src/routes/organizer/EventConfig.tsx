import { useParams } from "react-router";

export default function EventConfig() {
  const { eventId } = useParams();
  return <h1>Event Configuration — {eventId}</h1>;
}
