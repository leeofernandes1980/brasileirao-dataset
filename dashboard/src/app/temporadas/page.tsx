"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { getData, type TemporadaMeta, type Campeao } from "@/lib/data";
import { fmt } from "@/lib/utils";
import { Trophy } from "lucide-react";

export default function Temporadas() {
  const [metas, setMetas]     = useState<TemporadaMeta[]>([]);
  const [campeoes, setCampeoes] = useState<Record<number, string>>({});
  const [loading, setLoading]  = useState(true);

  useEffect(() => {
    Promise.all([getData.temporadasMeta(), getData.campeoes()]).then(([m, c]) => {
      setMetas(m.sort((a, b) => b.temporada - a.temporada));
      const map: Record<number, string> = {};
      c.forEach(x => { map[x.temporada] = x.clube; });
      setCampeoes(map);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center py-32 text-sm" style={{ color: "var(--muted)" }}>
      Carregando...
    </div>
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold" style={{ color: "var(--fg)" }}>Temporadas</h1>
        <span className="text-xs" style={{ color: "var(--muted)" }}>
          {metas.length} edicoes (2003–2026)
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {metas.map(m => (
          <Link key={m.temporada} href={`/temporadas/${m.temporada}`}
            className="card transition-all hover:scale-[1.02]"
            style={{ borderColor: m.temporada === 2026 ? "rgba(0,210,91,.3)" : "var(--border)" }}>
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold" style={{ color: "var(--fg)" }}>{m.temporada}</span>
                {m.temporada === 2026 && (
                  <span className="badge-green text-xs">Ao vivo</span>
                )}
              </div>
              {campeoes[m.temporada] && m.temporada < 2026 && (
                <div className="flex items-center gap-1 text-xs font-semibold"
                  style={{ color: "var(--yellow)" }}>
                  <Trophy size={12} />
                  {campeoes[m.temporada]}
                </div>
              )}
            </div>
            <div className="flex gap-4 text-xs" style={{ color: "var(--muted)" }}>
              <span>{fmt(m.total_partidas)} jogos</span>
              <span>{fmt(m.total_gols)} gols</span>
              <span>{m.total_partidas ? (m.total_gols / m.total_partidas).toFixed(2) : "—"} gols/jogo</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
