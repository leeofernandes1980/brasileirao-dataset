export default function Loading() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="h-10 w-56 rounded-lg" style={{ background: "var(--bg-card)" }} />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 h-80 rounded-xl" style={{ background: "var(--bg-card)" }} />
        <div className="h-80 rounded-xl" style={{ background: "var(--bg-card)" }} />
      </div>
      <div className="h-56 rounded-xl" style={{ background: "var(--bg-card)" }} />
    </div>
  );
}
