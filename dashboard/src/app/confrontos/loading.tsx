export default function Loading() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-32 rounded-xl" style={{ background: "var(--bg-card)" }} />
      <div className="h-64 rounded-xl" style={{ background: "var(--bg-card)" }} />
    </div>
  );
}
