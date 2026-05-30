import { Link } from "react-router";

export default function Home() {
  return (
    <div>
      <h1 className="text-4xl font-bold text-accent mb-4">Lineless</h1>
      <nav>
        <Link to="/organizer">Organizer</Link>
        {" · "}
        <Link to="/operator">Operator</Link>
      </nav>
    </div>
  );
}
