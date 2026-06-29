import { Outlet } from 'react-router';

export default function OperatorLayout() {
  // The operator area renders no navbar; each page brings its own left-aligned
  // header and any controls it needs.
  return (
    <div className="min-h-screen bg-background">
      <main>
        <Outlet />
      </main>
    </div>
  );
}
