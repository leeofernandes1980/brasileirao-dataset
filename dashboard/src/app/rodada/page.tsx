"use client";
import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { getData, type Partida } from "@/lib/data";
import { getClubColor } from "@/lib/clubs";
import ClubCrest from "@/components/ClubCrest";
import {
  calcProb, homeAwayStats, recentFormN, teamStrength,
  ELENCO_CONFIG, type ProbResult, type StrengthResult,
} from "@/lib/probabilidade";
import { Zap } from "lucide-react";

/* ── sub-componentes ─────────────────────────────────────────── */
function ResBadge({ r }: { r: "V"|"E"|"D" }) {
  return (
    <span className={`text-xs font-bold w-6 h-6 flex items-center justify-center rounded res-${r}`}>
      {r}
    </span>
  );
}

function Stars({ n }: { n: number }) {
  return (
    <span className="flex gap-px">
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} style={{ fontSize: 9, color: i < n ? "var(--yellow)" : "var(--border)" }}>★</span>
      ))}
    </span>
  );
}

/* ── card de uma partida ─────────────────────────────────────── */
interface JogoCardProps {
  mandante:  string;
  visitante: string;
  prob:      ProbResult | null;
  str1:      StrengthResult;
  str2:      StrengthResult;
  form1:     ReturnType<typeof recentFormN>;
  form2:     ReturnType<typeof recentFormN>;
  h2hTotal:  number;
}

function JogoCard({ mandante, visitante, prob, str1, str2, form1, form2, h2hTotal }: JogoCardProps) {
  const c1 = getClubColor(mandante);
  const c2 = getClubColor(visitante);

  return (
    <div className="card space-y-4">
      {/* header times */}
      <div className="flex items-center justify-between gap-2">
        {/* mandante */}
        <div className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
          <ClubCrest name={mandante} size={52} />
          <span className="text-xs font-semibold text-center leading-tight" style={{ color: "var(--fg)" }}>
            {mandante}
          </span>
          <Stars n={str1.stars} />
          {str1.warning && (
            <span className="text-xs" style={{ color: "var(--red)", fontSize: 9 }}>⚠ {str1.lastYear}</span>
          )}
        </div>

        {/* placar central */}
        <div className="flex flex-col items-center gap-1 px-2">
          <span className="text-lg font-black tabular-nums" style={{ color: "var(--muted)" }}>×</span>
          <span className="text-xs" style={{ color: "var(--muted)" }}>
            {h2hTotal > 0 ? `${h2hTotal} H2H` : "sem H2H"}
          </span>
        </div>

        {/* visitante */}
        <div className="flex flex-col items-center gap-1.5 flex-1 min-w-0">
          <ClubCrest name={visitante} size={52} />
          <span className="text-xs font-semibold text-center leading-tight" style={{ color: "var(--fg)" }}>
            {visitante}
          </span>
          <Stars n={str2.stars} />
          {str2.warning && (
            <span className="text-xs" style={{ color: "var(--red)", fontSize: 9 }}>⚠ {str2.lastYear}</span>
          )}
        </div>
      </div>

      {/* probabilidades */}
      {prob ? (
        <>
          {/* barra colorida */}
          <div className="flex rounded-full overflow-hidden h-2.5">
            <div style={{ width: `${prob.t1}%`, background: c1, transition: "width .5s" }} />
            <div style={{ width: `${prob.draw}%`, background: "var(--border)", transition: "width .5s" }} />
            <div style={{ width: `${prob.t2}%`, background: c2, transition: "width .5s" }} />
          </div>

          {/* percentuais */}
          <div className="grid grid-cols-3 text-center">
            <div>
              <div className="text-xl font-black" style={{ color: c1 }}>{prob.t1}%</div>
              <div className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
                {mandante.split(" ")[0]}
              </div>
            </div>
            <div>
              <div className="text-xl font-black" style={{ color: "var(--muted)" }}>{prob.draw}%</div>
              <div className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>Empate</div>
            </div>
            <div>
              <div className="text-xl font-black" style={{ color: c2 }}>{prob.t2}%</div>
              <div className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
                {visitante.split(" ")[0]}
              </div>
            </div>
          </div>

          {/* retrospecto H2H */}
          {prob.total > 0 && (
            <div className="flex justify-center gap-4 text-xs pt-1"
              style={{ borderTop: "1px solid var(--border)", color: "var(--muted)" }}>
              <span style={{ color: c1 }}><strong>{prob.vit1}</strong> V</span>
              <span><strong>{prob.emps}</strong> E</span>
              <span style={{ color: c2 }}><strong>{prob.vit2}</strong> V</span>
            </div>
          )}
        </>
      ) : (
        <div className="text-center text-xs py-2" style={{ color: "var(--muted)" }}>
          Sem confrontos diretos no histórico
        </div>
      )}

      {/* forma recente */}
      <div className="grid grid-cols-2 gap-3 pt-1" style={{ borderTop: "1px solid var(--border)" }}>
        <div>
          <div className="text-xs mb-1.5" style={{ color: "var(--muted)" }}>Forma ({form1.n}j)</div>
          <div className="flex gap-1 flex-wrap">
            {form1.results.map((r, i) => <ResBadge key={i} r={r} />)}
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs mb-1.5" style={{ color: "var(--muted)" }}>Forma ({form2.n}j)</div>
          <div className="flex gap-1 flex-wrap justify-end">
            {form2.results.map((r, i) => <ResBadge key={i} r={r} />)}
          </div>
        </div>
      </div>

      {/* link para confronto detalhado */}
      <Link
        href={`/confrontos?t1=${encodeURIComponent(mandante)}&t2=${encodeURIComponent(visitante)}`}
        className="block text-center text-xs py-1.5 rounded-lg transition-colors"
        style={{
          background: "rgba(61,124,245,.08)",
          color:      "var(--accent)",
          border:     "1px solid rgba(61,124,245,.2)",
        }}
      >
        Ver análise completa →
      </Link>
    </div>
  );
}

/* ── page ────────────────────────────────────────────────────── */
export default function RodadaPage() {
  const [partidas, setPartidas] = useState<Partida[]>([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    getData.partidas().then(setPartidas).finally(() => setLoading(false));
  }, []);

  const { rodada, jogos, jogosComProb, maxYear } = useMemo(() => {
    if (!partidas.length) return { rodada: 0, jogos: [], jogosComProb: [], maxYear: 2026 };

    const maxYear = partidas.reduce((m, p) => Math.max(m, p.temporada), 2003);
    const partidas2026 = partidas.filter(p => p.temporada === 2026);
    const comResultado = partidas.filter(p => p.gols_mandante !== null);

    // Próxima rodada: menor rodada de 2026 com pelo menos 1 jogo não disputado
    const proxRodada = partidas2026
      .filter(p => p.gols_mandante === null)
      .reduce((min, p) => Math.min(min, p.rodada), Infinity);

    if (!isFinite(proxRodada)) return { rodada: 0, jogos: [], jogosComProb: [], maxYear };

    const jogos = partidas2026
      .filter(p => p.rodada === proxRodada)
      .sort((a, b) => (a.data || "").localeCompare(b.data || "") || a.mandante.localeCompare(b.mandante));

    const jogosComProb = jogos.map(jogo => {
      const { mandante, visitante } = jogo;
      const confrontos = comResultado.filter(p =>
        (p.mandante===mandante&&p.visitante===visitante)||
        (p.mandante===visitante&&p.visitante===mandante)
      );
      const form1  = recentFormN(comResultado, mandante,  ELENCO_CONFIG.titular.formN);
      const form2  = recentFormN(comResultado, visitante, ELENCO_CONFIG.titular.formN);
      const stats1 = homeAwayStats(comResultado, mandante,  maxYear);
      const stats2 = homeAwayStats(comResultado, visitante, maxYear);
      const str1   = teamStrength(comResultado, mandante,  maxYear);
      const str2   = teamStrength(comResultado, visitante, maxYear);
      const prob   = calcProb(confrontos, mandante, visitante, form1, form2,
                              "t1_casa", "titular", stats1, stats2, str1, str2, maxYear);
      return { jogo, prob, str1, str2, form1, form2, h2hTotal: confrontos.length };
    });

    return { rodada: proxRodada, jogos, jogosComProb, maxYear };
  }, [partidas]);

  if (loading) return (
    <div className="flex items-center justify-center py-32 text-sm" style={{ color: "var(--muted)" }}>
      Carregando dados da rodada...
    </div>
  );

  if (!rodada) return (
    <div className="text-center py-32 text-sm" style={{ color: "var(--muted)" }}>
      Nenhuma rodada futura encontrada no dataset.
    </div>
  );

  // Ordena por "favorito mais claro" → maior gap entre 1º e 2º colocado
  const top = jogosComProb
    .filter(j => j.prob)
    .sort((a, b) => {
      const gapA = Math.max(a.prob!.t1, a.prob!.t2) - a.prob!.draw;
      const gapB = Math.max(b.prob!.t1, b.prob!.t2) - b.prob!.draw;
      return gapB - gapA;
    });
  const favorito = top[0];

  return (
    <div className="space-y-6">
      {/* header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, rgba(245,197,24,.2), rgba(245,197,24,.05))", border: "1px solid rgba(245,197,24,.3)" }}>
            <Zap size={18} style={{ color: "var(--yellow)" }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "var(--fg)" }}>
              Probabilidades · Rodada {rodada}
            </h1>
            <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
              Brasileirão 2026 · Modelo: H2H temporal + forma + força do elenco · Mando de campo ativo
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs px-2 py-1 rounded"
            style={{ background: "rgba(0,210,91,.1)", color: "var(--green)", border: "1px solid rgba(0,210,91,.2)" }}>
            {jogos.length} jogos
          </span>
          <Link href="/confrontos"
            className="text-xs px-3 py-1.5 rounded-lg"
            style={{ background: "var(--bg-card)", color: "var(--muted)", border: "1px solid var(--border)" }}>
            Confronto específico →
          </Link>
        </div>
      </div>

      {/* destaque: jogo com favorito mais claro */}
      {favorito && favorito.prob && (
        <div className="card"
          style={{ borderColor: "rgba(245,197,24,.25)", background: "linear-gradient(135deg, rgba(245,197,24,.05) 0%, transparent 100%)" }}>
          <div className="flex items-center gap-2 mb-4">
            <span style={{ fontSize: 14 }}>⚡</span>
            <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--yellow)" }}>
              Favorito da Rodada
            </span>
          </div>
          <div className="flex items-center gap-6">
            {/* mandante */}
            <div className="flex items-center gap-3 flex-1">
              <ClubCrest name={favorito.jogo.mandante} size={48} />
              <div>
                <div className="font-bold" style={{ color: "var(--fg)" }}>{favorito.jogo.mandante}</div>
                <div className="text-2xl font-black" style={{ color: getClubColor(favorito.jogo.mandante) }}>
                  {favorito.prob.t1}%
                </div>
              </div>
            </div>

            {/* centro */}
            <div className="flex flex-col items-center gap-1 shrink-0">
              <div className="text-sm font-bold" style={{ color: "var(--muted)" }}>
                {favorito.prob.draw}%
              </div>
              <div className="text-xs" style={{ color: "var(--muted)" }}>empate</div>
            </div>

            {/* visitante */}
            <div className="flex items-center gap-3 flex-1 flex-row-reverse text-right">
              <ClubCrest name={favorito.jogo.visitante} size={48} />
              <div>
                <div className="font-bold" style={{ color: "var(--fg)" }}>{favorito.jogo.visitante}</div>
                <div className="text-2xl font-black" style={{ color: getClubColor(favorito.jogo.visitante) }}>
                  {favorito.prob.t2}%
                </div>
              </div>
            </div>
          </div>

          {/* barra */}
          <div className="flex rounded-full overflow-hidden h-3 mt-4">
            <div style={{ width:`${favorito.prob.t1}%`, background: getClubColor(favorito.jogo.mandante) }} />
            <div style={{ width:`${favorito.prob.draw}%`, background: "var(--border)" }} />
            <div style={{ width:`${favorito.prob.t2}%`, background: getClubColor(favorito.jogo.visitante) }} />
          </div>
        </div>
      )}

      {/* tabela resumo */}
      <div className="card overflow-x-auto">
        <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--fg)" }}>
          Resumo da Rodada {rodada}
        </h2>
        <table className="table-auto w-full text-sm">
          <thead>
            <tr>
              <th className="text-left pl-0 min-w-[120px]">Mandante</th>
              <th className="w-16 text-center">Casa</th>
              <th className="w-12 text-center">Emp</th>
              <th className="w-16 text-center">Fora</th>
              <th className="text-right pr-0 min-w-[120px]">Visitante</th>
              <th className="w-20 text-center hidden sm:table-cell">H2H</th>
            </tr>
          </thead>
          <tbody>
            {jogosComProb.map(({ jogo, prob }) => {
              const c1 = getClubColor(jogo.mandante);
              const c2 = getClubColor(jogo.visitante);
              const favorite = prob && prob.t1 > prob.t2 ? "t1" : prob && prob.t2 > prob.t1 ? "t2" : "draw";
              return (
                <tr key={jogo.partida_id}>
                  <td className="pl-0">
                    <div className="flex items-center gap-2">
                      <ClubCrest name={jogo.mandante} size={22} />
                      <Link href={`/times/${encodeURIComponent(jogo.mandante)}`}
                        className="hover:underline font-medium" style={{ color: "var(--fg)" }}>
                        {jogo.mandante}
                      </Link>
                    </div>
                  </td>
                  <td className="text-center font-black text-base"
                    style={{ color: favorite==="t1" ? c1 : "var(--fg)" }}>
                    {prob ? `${prob.t1}%` : "—"}
                  </td>
                  <td className="text-center font-semibold" style={{ color: "var(--muted)" }}>
                    {prob ? `${prob.draw}%` : "—"}
                  </td>
                  <td className="text-center font-black text-base"
                    style={{ color: favorite==="t2" ? c2 : "var(--fg)" }}>
                    {prob ? `${prob.t2}%` : "—"}
                  </td>
                  <td className="pr-0">
                    <div className="flex items-center gap-2 justify-end">
                      <Link href={`/times/${encodeURIComponent(jogo.visitante)}`}
                        className="hover:underline font-medium" style={{ color: "var(--fg)" }}>
                        {jogo.visitante}
                      </Link>
                      <ClubCrest name={jogo.visitante} size={22} />
                    </div>
                  </td>
                  <td className="text-center hidden sm:table-cell">
                    {prob ? (
                      <span className="text-xs" style={{ color: "var(--muted)" }}>
                        {prob.vit1}–{prob.emps}–{prob.vit2}
                      </span>
                    ) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* cards detalhados */}
      <div>
        <h2 className="text-sm font-semibold mb-4" style={{ color: "var(--fg)" }}>
          Análise Detalhada — Jogo a Jogo
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {jogosComProb.map(({ jogo, prob, str1, str2, form1, form2, h2hTotal }) => (
            <JogoCard
              key={jogo.partida_id}
              mandante={jogo.mandante}
              visitante={jogo.visitante}
              prob={prob}
              str1={str1}
              str2={str2}
              form1={form1}
              form2={form2}
              h2hTotal={h2hTotal}
            />
          ))}
        </div>
      </div>

      <p className="text-xs text-center pb-2" style={{ color: "var(--muted)" }}>
        Modelo estatístico com decaimento temporal ({(1-(0.82))*100|0}% ao ano) · Não constitui previsão garantida
      </p>
    </div>
  );
}
