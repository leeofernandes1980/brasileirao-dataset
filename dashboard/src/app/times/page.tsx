"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { getData } from "@/lib/data";
import { Search } from "lucide-react";

function teamColor(name: string) {
  const colors = ["#e94560","#3d7cf5","#00d25b","#f5c518","#b388ff","#ff7043","#26c6da","#66bb6a","#ffa726","#ab47bc"];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

function initials(name: string) {
  const parts = name.split(/[\s\-]/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export default function Times() {
  const [clubes, setClubes] = useState<string[]>([]);
  const [busca, setBusca]   = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getData.clubes().then(c => setClubes(c.map(x => x.clube))).finally(() => setLoading(false));
  }, []);

  const filtrados = clubes.filter(c => c.toLowerCase().includes(busca.toLowerCase()));

  if (loading) return (
    <div className="flex items-center justify-center py-32 text-sm" style={{ color: "var(--muted)" }}>
      Carregando...
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold" style={{ color: "var(--fg)" }}>Times</h1>
        <span className="text-xs" style={{ color: "var(--muted)" }}>{filtrados.length} clubes</span>
      </div>

      <div className="relative max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--muted)" }} />
        <input type="text" placeholder="Buscar time..." value={busca}
          onChange={e => setBusca(e.target.value)}
          className="w-full pl-9 pr-4 py-2 text-sm rounded-lg focus:outline-none"
          style={{ background: "var(--bg-card)", border: "1px solid var(--border)", color: "var(--fg)" }} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {filtrados.map(clube => {
          const color = teamColor(clube);
          return (
            <Link key={clube} href={`/times/${encodeURIComponent(clube)}`}
              className="card text-center py-5 transition-all hover:scale-[1.03]"
              style={{ borderColor: "var(--border)" }}>
              <div className="w-12 h-12 rounded-full flex items-center justify-center
                              font-black text-sm mx-auto mb-3"
                style={{ background: `${color}22`, border: `2px solid ${color}55`, color }}>
                {initials(clube)}
              </div>
              <span className="text-sm font-medium leading-tight" style={{ color: "var(--fg)" }}>{clube}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
