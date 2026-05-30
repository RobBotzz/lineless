import { OperatorNavbar } from "../components/layout";

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <OperatorNavbar />
      <main className="mx-auto flex max-w-7xl flex-col items-center justify-center px-6 py-24 text-center">
        <h1 className="text-4xl font-bold text-accent mb-4">Lineless</h1>
      </main>
    </div>
  );
}
