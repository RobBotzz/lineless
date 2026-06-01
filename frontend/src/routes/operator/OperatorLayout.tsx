import { Link, Outlet } from 'react-router';

import { OperatorNavbar } from '../../components/layout/navbars';
import { paths } from '../../paths';

export default function OperatorLayout() {
  return (
    <div className="min-h-screen bg-background">
      <OperatorNavbar
        center={
          <span className="text-center text-xs font-semibold text-text-muted sm:text-sm">
            OperatorNavbar muss noch angepasst werden
          </span>
        }
        left={
          <Link className="font-logo text-2xl text-accent" to={paths.home}>
            <span className="underline decoration-current decoration-2 underline-offset-4">
              line
            </span>
            less
          </Link>
        }
        right={
          <Link className="text-sm font-semibold text-accent" to={paths.operator.root}>
            Stands
          </Link>
        }
      />
      <main>
        <Outlet />
      </main>
    </div>
  );
}
