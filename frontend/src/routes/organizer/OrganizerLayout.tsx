import { Outlet } from "react-router";

export default function OrganizerLayout() {
  return (
    <div>
      <header>Lineless — Organizer</header>
      <main>
        <Outlet />
      </main>
    </div>
  );
}
