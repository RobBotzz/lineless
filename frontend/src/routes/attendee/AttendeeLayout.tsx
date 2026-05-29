import { Outlet } from "react-router";

export default function AttendeeLayout() {
  return (
    <div>
      <header>Lineless — Attendee</header>
      <main>
        <Outlet />
      </main>
    </div>
  );
}
