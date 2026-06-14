"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getData, type Classificacao, type Partida, type Artilharia } from "@/lib/data";
import { fmt } from "@/lib/utils";
import { Trophy, ChevronLeft } from "lucide-react";
import ClubCrest from "@/components/ClubCrest";

const SITUACAO: Record<string, { label: string; color: string; bg: string }> = {
  "Campeão":       { label: "C", color: "var(--yellow)", bg: "rgba(245,197,24,.15)" },
  "Libertadores":  { label: "L", color: "var(--green)",  bg: "rgba(0,210,91,.12)"   },
  "Sul-Americana": { label: "S", color: "var(--accent)", bg: "rgba(61,124,245,.12)" },
  "Rebaixado":     { label: "↓", color: "var(--red)",    bg: "rgba(233,69,96,.12)"  },
};

export default function TemporadaPage() {
  const params = useParams();
  const ano = params?.ano as string;
  const temporada = parseInt(ano ?? "0");

  const [classif, setClassif]     = useState<Classificacao[]>([]);
  const [partidas, setPartidas]   = useState<Partida[]>([]);
  const [artilharia, setArtilh]   = useState<Artilharia[]>([]);
  const [rebaixamento, setRebx]   = useState<Record<string, string>>({});
  const [rodada, setRodada]       = useState<number>(1);
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    if (!temporada) return;
    Promise.all([
      getData.classificacao(),
      getData.partidas(),
      getData.artilharia(),
      getData.rebaixamento(),
    ]).then(([c, p, a, r]) => {
      setClassif(c.filter(x => x.temporada === temporada).sort((a, b) => b.pontos - a.pontos));
      const ps = p.filter(x => x.temporada === temporada);
      setPartidas(ps);
      setArtilh(a.filter(x => x.temporada === temporada).sort((a,b) => b.gols - a.gols).slice(0, 15));
      const map: Record<string, string> = {};
      r.filter((x: any) => x.temporada === temporada).forEach((x: any) => { map[x.clube] = x.situacao; });
      setRebx(map);
      const rods = [...new Set(ps.map(x => x.rodada))].sort((a, b) => b - a);
      setRodada(rods[0] || 1);
    }).finally(() => setLoading(false));
  }, [temporada]);

  if (loading) return (
    <div className="flex items-center justify-center py-32 text-sm" style={{ color: "var(--muted)" }}>
      Carregando...
    </div>
  );

  const rodadas = [...new Set(partidas.map(p => p.rodada))].sort((a, b) => a - b);
  const jogosDaRodada = partidas.filter(p => p.rodada === rodada)
    .sort((a, b) => (a.data || "").localeCompare(b.data || ""));
  const campeao = classif[0]?.clube;

  return (
    <div className="space-y-5">
      {/* header */}
      <div className="flex items-center gap-3">
        <Link href="/temporadas" style={{ color: "var(--muted)" }} className="hover:text-white transition-colors">
          <ChevronLeft size={20} />
        </Link>
        <h1 className="text-2xl font-bold" style={{ color: "var(--fg)" }}>Brasileirao {temporada}</h1>
        {temporada === 2026 && <span className="badge-green text-xs">Ao vivo</span>}
        {campeao && temporada < 2026 && (
          <div className="flex items-center gap-1.5 text-sm font-semibold ml-auto"
            style={{ color: "var(--yellow)" }}>
            <Trophy size={15} /> Campeao: {campeao}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* classificação */}
        <div className="card lg:col-span-2 overflow-x-auto">
          <h2 className="font-semibold mb-3 text-sm" style={{ color: "var(--fg)" }}>Classificacao Final</h2>
          <table className="table-auto w-full text-sm">
            <thead>
              <tr>
                <th className="w-6">#</th>
                <th className="text-left pl-2">Clube</th>
                <th>Pts</th><th>J</th><th>V</th><th>E</th><th>D</th>
                <th>GP</th><th>GC</th><th>SG</th>
              </tr>
            </thead>
            <tbody>
              {classif.map((c, i) => {
                const sit = rebaixamento[c.clube] || "";
                const sitStyle = SITUACAO[sit];
                return (
                  <tr key={c.clube}>
                    <td className="text-center text-xs" style={{ color: "var(--muted)" }}>{i + 1}</td>
                    <td className="pl-2">
                      <div className="flex items-center gap-2">
                        {sitStyle && (
                          <span className="text-xs w-5 h-5 flex items-center justify-center rounded font-bold shrink-0"
                            style={{ background: sitStyle.bg, color: sitStyle.color }}>
                            {sitStyle.label}
                          </span>
                        )}
                        <ClubCrest name={c.clube} size={20} />
                        <Link href={`/times/${encodeURIComponent(c.clube)}`}
                          className="hover:underline font-medium" style={{ color: "var(--fg)" }}>
                          {c.clube}
                        </Link>
                      </div>
                    </td>
                    <td className="text-center font-bold" style={{ color: "var(--green)" }}>{c.pontos}</td>
                    <td className="text-center" style={{ color: "var(--muted)" }}>{c.vitorias + c.empates + c.derrotas}</td>
                    <td className="text-center" style={{ color: "var(--green)" }}>{c.vitorias}</td>
                    <td className="text-center" style={{ color: "var(--yellow)" }}>{c.empates}</td>
                    <td className="text-center" style={{ color: "var(--red)" }}>{c.derrotas}</td>
                    <td className="text-center" style={{ color: "var(--fg)" }}>{c.gols_pro}</td>
                    <td className="text-center" style={{ color: "var(--fg)" }}>{c.gols_contra}</td>
                    <td className="text-center font-medium" style={{ color: "var(--fg)" }}>
                      {(c.gols_pro - c.gols_contra) > 0 ? "+" : ""}{c.gols_pro - c.gols_contra}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* artilharia */}
        <div className="card">
          <h2 className="font-semibold mb-3 text-sm" style={{ color: "var(--fg)" }}>Artilharia</h2>
          {artilharia.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--muted)" }}>Dados nao disponiveis</p>
          ) : (
            <ul className="space-y-2">
              {artilharia.map((a, i) => (
                <li key={`${a.atleta}-${i}`} className="flex items-center justify-between gap-2 text-sm">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs w-4 text-right shrink-0" style={{ color: "var(--muted)" }}>{i+1}</span>
                    <div className="min-w-0">
                      <div className="font-medium truncate" style={{ color: "var(--fg)" }}>{a.atleta}</div>
                      <div className="text-xs truncate" style={{ color: "var(--muted)" }}>{a.clube}</div>
                    </div>
                  </div>
                  <span className="font-bold text-base shrink-0 px-2 py-0.5 rounded"
                    style={{ background: "rgba(0,210,91,.12)", color: "var(--green)" }}>
                    {a.gols}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* rodadas */}
      <div className="card">
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <h2 className="font-semibold text-sm" style={{ color: "var(--fg)" }}>Rodadas</h2>
          <div className="flex gap-1 flex-wrap">
            {rodadas.map(r => (
              <button key={r} onClick={() => setRodada(r)}
                className="text-xs px-2.5 py-1 rounded transition-all"
                style={{
                  background: r === rodada ? "rgba(61,124,245,.2)" : "var(--bg-hover)",
                  color: r === rodada ? "var(--accent)" : "var(--muted)",
                  border: `1px solid ${r === rodada ? "rgba(61,124,245,.4)" : "var(--border)"}`,
                }}>
                {r}
              </button>
            ))}
          </div>
        </div>

        {jogosDaRodada.length === 0 ? (
          <p className="text-sm" style={{ color: "var(--muted)" }}>Nenhum jogo nessa rodada.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {jogosDaRodada.map(p => {
              const gm = p.gols_mandante, gv = p.gols_visitante;
              const hasResult = gm !== null && gv !== null;
              return (
                <div key={p.partida_id}
                  className="flex items-center justify-between rounded-lg px-3 py-2.5 text-sm"
                  style={{ background: "var(--bg-hover)" }}>
                  <div className="flex-1 flex items-center justify-end gap-2 min-w-0">
                    <span className="font-medium truncate" style={{ color: "var(--fg)" }}>{p.mandante}</span>
                    <ClubCrest name={p.mandante} size={20} />
                  </div>
                  <span className="font-black tabular-nums px-3 shrink-0 text-base" style={{ color: "var(--fg)" }}>
                    {hasResult ? `${gm} × ${gv}` : "– × –"}
                  </span>
                  <div className="flex-1 flex items-center gap-2 min-w-0">
                    <ClubCrest name={p.visitante} size={20} />
                    <span className="font-medium truncate" style={{ color: "var(--fg)" }}>{p.visitante}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
