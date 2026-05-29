import { Outlet } from "react-router";

export default function OperatorLayout() {
  return (
    <div>
      <header>Lineless — Operator</header>
      <main>
        <Outlet />
      </main>
    </div>
  );
}
