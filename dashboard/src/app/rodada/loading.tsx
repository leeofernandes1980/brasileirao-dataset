export default function Loading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-12 rounded-xl w-80" style={{ background: "var(--bg-card)" }} />
      <div className="h-28 rounded-xl" style={{ background: "var(--bg-card)" }} />
      <div className="h-48 rounded-xl" style={{ background: "var(--bg-card)" }} />
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {Array.from({ length: 10 }).map((_, i) => (
          <div key={i} className="h-72 rounded-xl" style={{ background: "var(--bg-card)" }} />
        ))}
      </div>
    </div>
  );
}
