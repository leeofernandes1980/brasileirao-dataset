"use client";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getData, type Partida } from "@/lib/data";
import ClubCrest from "@/components/ClubCrest";
import { getClubColor } from "@/lib/clubs";
import {
  DECAY, STR_W, ELENCO_CONFIG,
  homeAwayStats, recentFormN, teamStrength, calcProb,
  type Elenco, type Mando, type StrengthResult,
} from "@/lib/probabilidade";

/* ── constantes locais ────────────────────────────────────── */
const TABS = ["Retrospecto", "Probabilidade", "Forma", "Historico"] as const;
type Tab   = typeof TABS[number];

/* ── helpers visuais ──────────────────────────────────────── */
function ResBadge({ r }: { r:"V"|"E"|"D" }) {
  return <span className={`text-xs font-bold w-7 h-7 flex items-center justify-center rounded res-${r}`}>{r}</span>;
}

/* ── Stars component ─────────────────────────────────────── */
function StrengthStars({ str }: { str: StrengthResult }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} style={{ fontSize: 10, color: i < str.stars ? "var(--yellow)" : "var(--border)" }}>★</span>
      ))}
    </div>
  );
}

/* ── page ─────────────────────────────────────────────────── */
export default function Confrontos() {
  const params = useSearchParams();
  const [clubes, setClubes]     = useState<string[]>([]);
  const [partidas, setPartidas] = useState<Partida[]>([]);
  const [maxYear, setMaxYear]   = useState(2026);
  const [time1, setTime1]       = useState(params.get("t1") ?? "");
  const [time2, setTime2]       = useState(params.get("t2") ?? "");
  const [tab, setTab]           = useState<Tab>("Retrospecto");
  const [mando, setMando]       = useState<Mando>("todos");
  const [elenco, setElenco]     = useState<Elenco>("titular");
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    Promise.all([getData.clubes(), getData.partidas()]).then(([c, p]) => {
      const ps = p.filter(x => x.gols_mandante !== null);
      setClubes(c.map(x => x.clube));
      setPartidas(ps);
      setMaxYear(ps.reduce((m, x) => Math.max(m, x.temporada), 2003));
    }).finally(() => setLoading(false));
  }, []);

  const todosConfrontos = (time1 && time2)
    ? partidas.filter(p =>
        (p.mandante===time1 && p.visitante===time2) ||
        (p.mandante===time2 && p.visitante===time1)
      ).sort((a,b) => b.temporada-a.temporada || b.rodada-a.rodada)
    : [];

  const confrontosFiltrados = mando === "t1_casa"
    ? todosConfrontos.filter(p => p.mandante === time1)
    : mando === "t2_casa"
    ? todosConfrontos.filter(p => p.mandante === time2)
    : todosConfrontos;

  const formN  = ELENCO_CONFIG[elenco].formN;
  const form1  = time1 ? recentFormN(partidas, time1, formN) : null;
  const form2  = time2 ? recentFormN(partidas, time2, formN) : null;
  const stats1 = time1 ? homeAwayStats(partidas, time1, maxYear) : null;
  const stats2 = time2 ? homeAwayStats(partidas, time2, maxYear) : null;
  const str1   = time1 ? teamStrength(partidas, time1, maxYear) : null;
  const str2   = time2 ? teamStrength(partidas, time2, maxYear) : null;

  const prob = (form1 && form2 && stats1 && stats2 && str1 && str2)
    ? calcProb(confrontosFiltrados, time1, time2, form1, form2, mando, elenco, stats1, stats2, str1, str2, maxYear)
    : null;

  const color1 = time1 ? getClubColor(time1) : "var(--accent)";
  const color2 = time2 ? getClubColor(time2) : "var(--muted)";

  const Select = ({ value, onChange, placeholder }: { value:string; onChange:(v:string)=>void; placeholder:string }) => (
    <select value={value} onChange={e => onChange(e.target.value)}
      className="w-full rounded-lg px-3 py-2 text-sm font-medium focus:outline-none"
      style={{ background:"var(--bg-hover)", border:"1px solid var(--border)", color:value?"var(--fg)":"var(--muted)" }}>
      <option value="">{placeholder}</option>
      {clubes.map(c => <option key={c} value={c}>{c}</option>)}
    </select>
  );

  if (loading) return (
    <div className="flex items-center justify-center py-32 text-sm" style={{ color:"var(--muted)" }}>Carregando...</div>
  );

  const hasMatch = time1 && time2 && time1 !== time2;

  return (
    <div className="space-y-0">
      {/* selectors + filtros */}
      <div className="card rounded-b-none border-b-0">
        <div className="grid grid-cols-3 gap-4 items-center mb-4">
          <Select value={time1} onChange={v => { setTime1(v); setMando("todos"); }} placeholder="Selecionar Time 1" />
          <div className="text-center text-xl font-black" style={{ color:"var(--muted)" }}>VS</div>
          <Select value={time2} onChange={v => { setTime2(v); setMando("todos"); }} placeholder="Selecionar Time 2" />
        </div>

        {hasMatch && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3"
            style={{ borderTop:"1px solid var(--border)" }}>
            {/* mando */}
            <div>
              <label className="text-xs font-semibold uppercase tracking-widest mb-2 block" style={{ color:"var(--muted)" }}>
                Mando de campo
              </label>
              <div className="flex gap-1.5 flex-wrap">
                {([
                  { v:"todos",   l:"Neutro / Todos"   },
                  { v:"t1_casa", l:`${time1} em casa` },
                  { v:"t2_casa", l:`${time2} em casa` },
                ] as { v: Mando; l: string }[]).map(({ v, l }) => (
                  <button key={v} onClick={() => setMando(v)}
                    className="text-xs px-3 py-1.5 rounded-full transition-all"
                    style={{
                      background: mando===v ? (v==="t1_casa"?`${color1}22`:v==="t2_casa"?`${color2}22`:"rgba(61,124,245,.2)") : "var(--bg-hover)",
                      color:      mando===v ? (v==="t1_casa"?color1:v==="t2_casa"?color2:"var(--accent)") : "var(--muted)",
                      border:     `1px solid ${mando===v?(v==="t1_casa"?`${color1}44`:v==="t2_casa"?`${color2}44`:"rgba(61,124,245,.4)"):"var(--border)"}`,
                    }}>
                    {l}
                  </button>
                ))}
              </div>
            </div>

            {/* elenco */}
            <div>
              <label className="text-xs font-semibold uppercase tracking-widest mb-2 block" style={{ color:"var(--muted)" }}>
                Forca do elenco
              </label>
              <div className="flex gap-1.5">
                {(Object.entries(ELENCO_CONFIG) as [Elenco, typeof ELENCO_CONFIG[Elenco]][]).map(([k, cfg]) => (
                  <button key={k} onClick={() => setElenco(k)} title={cfg.desc}
                    className="text-xs px-3 py-1.5 rounded-full transition-all"
                    style={{
                      background: elenco===k ? "rgba(0,210,91,.15)" : "var(--bg-hover)",
                      color:      elenco===k ? "var(--green)"        : "var(--muted)",
                      border:     `1px solid ${elenco===k?"rgba(0,210,91,.35)":"var(--border)"}`,
                    }}>
                    {cfg.label}
                  </button>
                ))}
              </div>
              <p className="text-xs mt-1.5" style={{ color:"var(--muted)" }}>
                {ELENCO_CONFIG[elenco].desc} · {formN} jogos · H2H:{((ELENCO_CONFIG[elenco].h2hW*(1-STR_W))*100).toFixed(0)}% Forma:{(((1-ELENCO_CONFIG[elenco].h2hW)*(1-STR_W))*100).toFixed(0)}% Forca:{(STR_W*100).toFixed(0)}%
              </p>
            </div>
          </div>
        )}
      </div>

      {/* match header */}
      {hasMatch && (
        <>
          <div style={{ background:"var(--bg-card)", borderLeft:"1px solid var(--border)", borderRight:"1px solid var(--border)", padding:"2rem 1.5rem 0" }}>
            <div className="flex items-center justify-between mb-6">
              {/* time 1 */}
              <div className="flex flex-col items-center gap-2 text-center flex-1">
                <ClubCrest name={time1} size={60} />
                <span className="font-bold text-base" style={{ color:"var(--fg)" }}>{time1}</span>
                {str1 && (
                  <div className="flex flex-col items-center gap-1">
                    <StrengthStars str={str1} />
                    <span className="text-xs" style={{ color: str1.warning ? "var(--red)" : "var(--muted)" }}>
                      {str1.warning || `${str1.ptsPerGame} pts/jogo (${str1.lastYear})`}
                    </span>
                  </div>
                )}
                {mando !== "todos" && stats1 && (
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ background:`${color1}15`, color:color1 }}>
                    {mando==="t1_casa" ? `Casa ${stats1.homePct}%` : `Fora ${stats1.awayPct}%`}
                  </span>
                )}
                {form1 && (
                  <div className="flex gap-1">{form1.results.slice(0,5).map((r,i) => <ResBadge key={i} r={r} />)}</div>
                )}
              </div>

              {/* center */}
              <div className="flex flex-col items-center gap-1 px-4">
                <div className="text-2xl font-black" style={{ color:"var(--muted)" }}>
                  {confrontosFiltrados.length > 0 ? `${prob?.vit1??0} – ${prob?.vit2??0}` : "– – –"}
                </div>
                <div className="text-xs" style={{ color:"var(--muted)" }}>
                  {confrontosFiltrados.length} jogos{mando!=="todos"?" (filtrado)":""}
                </div>
                {confrontosFiltrados.length > 0 && prob && (
                  <div className="flex w-44 h-1.5 rounded-full overflow-hidden mt-1">
                    <div style={{ width:`${(prob.vit1/confrontosFiltrados.length)*100}%`, background:color1 }} />
                    <div style={{ width:`${(prob.emps/confrontosFiltrados.length)*100}%`, background:"var(--border)" }} />
                    <div style={{ width:`${(prob.vit2/confrontosFiltrados.length)*100}%`, background:color2 }} />
                  </div>
                )}
              </div>

              {/* time 2 */}
              <div className="flex flex-col items-center gap-2 text-center flex-1">
                <ClubCrest name={time2} size={60} />
                <span className="font-bold text-base" style={{ color:"var(--fg)" }}>{time2}</span>
                {str2 && (
                  <div className="flex flex-col items-center gap-1">
                    <StrengthStars str={str2} />
                    <span className="text-xs" style={{ color: str2.warning ? "var(--red)" : "var(--muted)" }}>
                      {str2.warning || `${str2.ptsPerGame} pts/jogo (${str2.lastYear})`}
                    </span>
                  </div>
                )}
                {mando !== "todos" && stats2 && (
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ background:`${color2}15`, color:color2 }}>
                    {mando==="t2_casa" ? `Casa ${stats2.homePct}%` : `Fora ${stats2.awayPct}%`}
                  </span>
                )}
                {form2 && (
                  <div className="flex gap-1">{form2.results.slice(0,5).map((r,i) => <ResBadge key={i} r={r} />)}</div>
                )}
              </div>
            </div>

            {/* tabs */}
            <div className="tab-bar">
              {TABS.map(t => (
                <button key={t} className={`tab ${tab===t?"active":""}`} onClick={() => setTab(t)}>{t}</button>
              ))}
            </div>
          </div>

          {/* tab content */}
          <div style={{ background:"var(--bg-card)", border:"1px solid var(--border)", borderTop:"none", borderRadius:"0 0 0.75rem 0.75rem", padding:"1.5rem" }}>

            {/* RETROSPECTO */}
            {tab === "Retrospecto" && (
              <div className="space-y-4">
                {confrontosFiltrados.length === 0 ? (
                  <p className="text-center py-8 text-sm" style={{ color:"var(--muted)" }}>
                    Nenhum confronto direto com esses filtros.
                  </p>
                ) : prob && (
                  <>
                    <div className="grid grid-cols-3 gap-4 text-center">
                      {[
                        { val:prob.vit1, label:time1,   color:color1 },
                        { val:prob.emps, label:"Empates", color:"var(--muted)" },
                        { val:prob.vit2, label:time2,    color:color2 },
                      ].map(({ val, label, color }) => (
                        <div key={label} className="rounded-xl py-4" style={{ background:"var(--bg-hover)" }}>
                          <div className="text-3xl font-black" style={{ color }}>{val}</div>
                          <div className="text-xs mt-1 truncate px-2" style={{ color:"var(--muted)" }}>{label}</div>
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-center gap-8 text-sm" style={{ color:"var(--muted)" }}>
                      {(() => {
                        const tg = confrontosFiltrados.reduce((s,p)=>s+(p.gols_mandante??0)+(p.gols_visitante??0),0);
                        return (<>
                          <span>Gols totais: <strong style={{ color:"var(--fg)" }}>{tg}</strong></span>
                          <span>Media: <strong style={{ color:"var(--fg)" }}>{(tg/confrontosFiltrados.length).toFixed(2)}</strong> por jogo</span>
                        </>);
                      })()}
                    </div>
                    {/* home/away breakdown */}
                    {stats1 && stats2 && (
                      <div className="grid grid-cols-2 gap-3 pt-2" style={{ borderTop:"1px solid var(--border)" }}>
                        {[{team:time1,st:stats1,color:color1},{team:time2,st:stats2,color:color2}].map(({team,st,color})=>(
                          <div key={team} className="rounded-lg p-3" style={{ background:"var(--bg-hover)" }}>
                            <div className="text-xs font-bold mb-2" style={{ color }}>{team}</div>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div>
                                <span style={{ color:"var(--muted)" }}>Em casa</span><br/>
                                <strong style={{ color:"var(--green)" }}>{st.homePct}%</strong>
                                <span style={{ color:"var(--muted)" }}> ({st.homeW}V {st.homeD}E {st.homeL}D/{st.homeTotal}j)</span>
                              </div>
                              <div>
                                <span style={{ color:"var(--muted)" }}>Fora</span><br/>
                                <strong style={{ color }}>{st.awayPct}%</strong>
                                <span style={{ color:"var(--muted)" }}> ({st.awayW}V {st.awayD}E {st.awayL}D/{st.awayTotal}j)</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* PROBABILIDADE */}
            {tab === "Probabilidade" && (
              <div className="space-y-5">
                {!prob ? (
                  <p className="text-center py-8 text-sm" style={{ color:"var(--muted)" }}>
                    Nao ha confrontos suficientes com esses filtros.
                  </p>
                ) : (
                  <>
                    {/* chips de metodologia */}
                    <div className="flex flex-wrap gap-2">
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{ background:"rgba(61,124,245,.12)", color:"var(--accent)" }}>
                        H2H ponderado: {((ELENCO_CONFIG[elenco].h2hW*(1-STR_W))*100).toFixed(0)}%
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{ background:"rgba(0,210,91,.1)", color:"var(--green)" }}>
                        Forma {ELENCO_CONFIG[elenco].formN}j: {(((1-ELENCO_CONFIG[elenco].h2hW)*(1-STR_W))*100).toFixed(0)}%
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full" style={{ background:"rgba(245,197,24,.1)", color:"var(--yellow)" }}>
                        Forca do elenco: {(STR_W*100).toFixed(0)}%
                      </span>
                      {mando !== "todos" && (
                        <span className="text-xs px-2 py-0.5 rounded-full" style={{ background:"rgba(179,136,255,.1)", color:"#b388ff" }}>
                          Mando ativo
                        </span>
                      )}
                    </div>

                    {/* probabilities */}
                    <div className="grid grid-cols-3 gap-3 text-center">
                      {[
                        { pct:prob.t1,   label:time1,   color:color1 },
                        { pct:prob.draw, label:"Empate", color:"var(--muted)" },
                        { pct:prob.t2,   label:time2,   color:color2 },
                      ].map(({ pct, label, color }) => (
                        <div key={label} className="rounded-xl p-5" style={{ background:"var(--bg-hover)" }}>
                          <div className="text-3xl font-black" style={{ color }}>{pct}%</div>
                          <div className="text-xs mt-1 truncate" style={{ color:"var(--muted)" }}>{label}</div>
                        </div>
                      ))}
                    </div>

                    <div className="flex rounded-full overflow-hidden h-5 text-xs font-bold">
                      <div className="flex items-center justify-center text-white transition-all"
                        style={{ width:`${prob.t1}%`, background:color1 }}>
                        {prob.t1>=10?`${prob.t1}%`:""}
                      </div>
                      <div className="flex items-center justify-center transition-all"
                        style={{ width:`${prob.draw}%`, background:"var(--border)", color:"var(--muted)" }}>
                        {prob.draw>=10?`${prob.draw}%`:""}
                      </div>
                      <div className="flex items-center justify-center text-white transition-all"
                        style={{ width:`${prob.t2}%`, background:color2 }}>
                        {prob.t2>=10?`${prob.t2}%`:""}
                      </div>
                    </div>

                    {/* breakdown dos 3 fatores */}
                    <div className="space-y-2">
                      <p className="text-xs font-semibold uppercase tracking-widest" style={{ color:"var(--muted)" }}>Detalhamento dos fatores</p>

                      {/* H2H ponderado */}
                      <div className="rounded-lg p-3" style={{ background:"var(--bg-hover)" }}>
                        <div className="flex justify-between text-xs mb-1">
                          <span style={{ color:"var(--accent)" }}>H2H temporal (peso {((ELENCO_CONFIG[elenco].h2hW*(1-STR_W))*100).toFixed(0)}%)</span>
                          <span style={{ color:"var(--muted)" }}>{prob.h2h.totalW.toFixed(1)} jogos ponderados de {confrontosFiltrados.length}</span>
                        </div>
                        <div className="flex gap-4 text-sm">
                          <span style={{ color:color1 }}><strong>{prob.h2h.pct1}%</strong> {time1.split(" ")[0]}</span>
                          <span style={{ color:"var(--muted)" }}><strong>{prob.h2h.pctDraw}%</strong> Emp</span>
                          <span style={{ color:color2 }}><strong>{prob.h2h.pct2}%</strong> {time2.split(" ")[0]}</span>
                        </div>
                      </div>

                      {/* Força do elenco */}
                      {str1 && str2 && (
                        <div className="rounded-lg p-3" style={{ background:"var(--bg-hover)" }}>
                          <div className="text-xs mb-2" style={{ color:"var(--yellow)" }}>
                            Forca do elenco (peso {(STR_W*100).toFixed(0)}%)
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            {[{team:time1,str:str1,color:color1},{team:time2,str:str2,color:color2}].map(({team,str,color})=>(
                              <div key={team}>
                                <div className="flex items-center gap-2 mb-1">
                                  <StrengthStars str={str} />
                                  <span className="text-xs font-bold" style={{ color }}>{(str.score*100).toFixed(0)} pts</span>
                                </div>
                                <div className="text-xs" style={{ color:"var(--muted)" }}>
                                  {str.ptsPerGame} pts/j em {str.lastYear} ({str.games} jogos)
                                </div>
                                {str.warning && (
                                  <div className="text-xs mt-0.5" style={{ color:"var(--red)" }}>⚠ {str.warning}</div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {mando !== "todos" && stats1 && stats2 && (
                      <div className="rounded-lg p-3 text-xs" style={{ background:"rgba(245,197,24,.06)", border:"1px solid rgba(245,197,24,.15)" }}>
                        <strong style={{ color:"var(--yellow)" }}>Fator mando:</strong>
                        <span style={{ color:"var(--muted)" }}> {mando==="t1_casa"
                          ? `${time1} vence ${stats1.homePct}% em casa · ${time2} vence ${stats2.awayPct}% fora`
                          : `${time2} vence ${stats2.homePct}% em casa · ${time1} vence ${stats1.awayPct}% fora`}
                        </span>
                      </div>
                    )}

                    <p className="text-xs" style={{ color:"var(--muted)" }}>
                      Modelo: H2H com decaimento temporal ({DECAY} por ano) + forma recente (Série A) + forca do elenco.
                      Estimativa estatistica — nao constitui previsao exata.
                    </p>
                  </>
                )}
              </div>
            )}

            {/* FORMA */}
            {tab === "Forma" && form1 && form2 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {([
                  { team:time1, form:form1, color:color1, stats:stats1, str:str1 },
                  { team:time2, form:form2, color:color2, stats:stats2, str:str2 },
                ] as const).map(({ team, form, color, stats, str }) => (
                  <div key={team}>
                    <div className="flex items-center gap-2 mb-3">
                      <ClubCrest name={team} size={28} />
                      <span className="font-semibold text-sm" style={{ color:"var(--fg)" }}>{team}</span>
                      {str && <StrengthStars str={str} />}
                    </div>
                    <div className="flex gap-1.5 mb-3">
                      {form.results.map((r,i) => <ResBadge key={i} r={r} />)}
                    </div>
                    <div className="flex rounded-full overflow-hidden h-2 mb-2">
                      <div style={{ width:`${(form.wins/form.n)*100}%`, background:"var(--green)" }} />
                      <div style={{ width:`${(form.draws/form.n)*100}%`, background:"var(--yellow)" }} />
                      <div style={{ width:`${(form.losses/form.n)*100}%`, background:"var(--red)" }} />
                    </div>
                    <div className="flex gap-4 text-sm mb-1">
                      <span style={{ color:"var(--green)" }}><strong>{form.wins}</strong> V</span>
                      <span style={{ color:"var(--yellow)" }}><strong>{form.draws}</strong> E</span>
                      <span style={{ color:"var(--red)" }}><strong>{form.losses}</strong> D</span>
                      <span style={{ color:"var(--muted)" }}>de {form.n} jogos (Série A)</span>
                    </div>
                    {str && str.warning && (
                      <div className="text-xs mb-2 px-2 py-1 rounded" style={{ background:"rgba(233,69,96,.1)", color:"var(--red)" }}>
                        ⚠ {str.warning}
                      </div>
                    )}
                    {stats && (
                      <div className="flex gap-3 text-xs mb-3">
                        <span className="px-2 py-1 rounded" style={{ background:`${color}12`, color }}>
                          Casa {stats.homePct}%
                        </span>
                        <span className="px-2 py-1 rounded" style={{ background:"var(--bg-hover)", color:"var(--muted)" }}>
                          Fora {stats.awayPct}%
                        </span>
                      </div>
                    )}
                    <div className="space-y-1.5">
                      {form.details.map((d,i) => (
                        <div key={i} className="flex items-center gap-3 rounded-lg px-3 py-2 text-xs"
                          style={{ background:"var(--bg-hover)" }}>
                          <ResBadge r={d.res} />
                          <span style={{ color:"var(--muted)" }}>{d.temp} R{d.rod}</span>
                          <span className="flex-1 truncate" style={{ color:"var(--fg)" }}>{d.opp}</span>
                          <span className="font-bold tabular-nums" style={{ color:"var(--fg)" }}>{d.gp}–{d.gc}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* HISTORICO */}
            {tab === "Historico" && (
              <div className="space-y-1.5 max-h-[480px] overflow-auto">
                {todosConfrontos.length === 0 ? (
                  <p className="text-center py-8 text-sm" style={{ color:"var(--muted)" }}>Nenhum confronto registrado.</p>
                ) : todosConfrontos.map(p => {
                  const gm=p.gols_mandante??0, gv=p.gols_visitante??0;
                  const t1home = p.mandante===time1;
                  const t1venceu = t1home ? gm>gv : gv>gm;
                  const empate = gm===gv;
                  const res: "V"|"E"|"D" = empate?"E":t1venceu?"V":"D";
                  const isMandoHighlight = (mando==="t1_casa"&&p.mandante===time1)||(mando==="t2_casa"&&p.mandante===time2);
                  const w = Math.pow(DECAY, maxYear - p.temporada);
                  const wPct = Math.round(w * 100);

                  return (
                    <div key={p.partida_id}
                      className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm"
                      style={{ background: isMandoHighlight?"rgba(61,124,245,.08)":"var(--bg-hover)",
                               border: isMandoHighlight?"1px solid rgba(61,124,245,.2)":"1px solid transparent" }}>
                      <span className="text-xs w-20 shrink-0" style={{ color:"var(--muted)" }}>{p.temporada} R{p.rodada}</span>
                      <ResBadge r={res} />
                      <span className="flex-1 text-right font-medium truncate"
                        style={{ color:!empate&&((t1home&&t1venceu)||(!t1home&&!t1venceu))?color1:"var(--fg)" }}>
                        {p.mandante}
                      </span>
                      <span className="font-black tabular-nums px-3 text-base shrink-0" style={{ color:"var(--fg)" }}>
                        {gm} – {gv}
                      </span>
                      <span className="flex-1 font-medium truncate"
                        style={{ color:!empate&&((!t1home&&t1venceu)||(t1home&&!t1venceu))?color1:"var(--fg)" }}>
                        {p.visitante}
                      </span>
                      <span className="text-xs shrink-0 px-1.5 py-0.5 rounded tabular-nums"
                        style={{ background:"var(--bg)", color:"var(--muted)", opacity: 0.8 }}
                        title="Peso temporal deste jogo no calculo">
                        {wPct}%
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}

      {time1 && time2 && time1 === time2 && (
        <div className="card text-center text-sm py-6" style={{ color:"var(--muted)" }}>Selecione dois times diferentes.</div>
      )}
    </div>
  );
}
