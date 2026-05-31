import { Outlet } from 'react-router';

import { OrganizerNavbar } from '../../components/layout';

export default function OrganizerLayout() {
  return (
    <div className="min-h-screen bg-background">
      <OrganizerNavbar />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  );
}
