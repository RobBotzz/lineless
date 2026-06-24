export function OperationalCanvas({ title, message }: { title: string; message: string }) {
  return (
    <div className="relative min-h-48 overflow-hidden rounded-lg border border-dashed border-border bg-surface-muted/40 p-4">
      <div className="absolute inset-0 bg-[linear-gradient(var(--color-border)_1px,transparent_1px),linear-gradient(90deg,var(--color-border)_1px,transparent_1px)] bg-[size:28px_28px] opacity-30" />
      <div className="relative flex h-full min-h-40 flex-col items-center justify-center text-center">
        <p className="font-semibold text-text">{title}</p>
        <p className="mt-2 max-w-md text-sm text-text-muted">{message}</p>
      </div>
    </div>
  );
}
