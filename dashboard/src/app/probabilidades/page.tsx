"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { getData } from "@/lib/data";
import { simularTemporada, ZONAS, type SimResult, type TeamSim, type Zona } from "@/lib/simulacao";
import ClubCrest from "@/components/ClubCrest";
import { Percent, Trophy, ShieldAlert, Globe2, Star, Info } from "lucide-react";

/* ── formatação ──────────────────────────────────────────────── */
const nf1 = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

function fmtProb(t: TeamSim, z: Zona): { txt: string; title: string } {
  const p = t.prob[z];
  if (t.garantido[z])  return { txt: "✓", title: "Matematicamente garantido" };
  if (t.eliminado[z])  return { txt: "–", title: "Matematicamente impossível" };
  if (p === 0)         return { txt: "<0,1%", title: "Possível, mas não ocorreu em nenhuma simulação" };
  if (p < 0.001)       return { txt: "<0,1%", title: "" };
  if (p > 0.999)       return { txt: ">99,9%", title: "" };
  return { txt: `${nf1.format(p * 100)}%`, title: "" };
}

function zonaDaPosicao(pos: number): Zona | null {
  if (pos === 1) return "titulo";
  if (pos <= ZONAS.libertadores.ate) return "libertadores";
  if (pos >= ZONAS.sula.de && pos <= ZONAS.sula.ate) return "sula";
  if (pos >= ZONAS.rebaixamento.de) return "rebaixamento";
  return null;
}

/* ── célula de probabilidade ─────────────────────────────────── */
function ProbCell({ t, z, className = "" }: { t: TeamSim; z: Zona; className?: string }) {
  const { txt, title } = fmtProb(t, z);
  const p = t.garantido[z] ? 1 : t.eliminado[z] ? 0 : t.prob[z];
  const cor = ZONAS[z].cor;
  const alpha = p > 0 ? Math.round((0.06 + 0.5 * p) * 255).toString(16).padStart(2, "0") : "00";
  return (
    <td className={`text-center tabular-nums text-xs font-semibold ${className}`} title={title || undefined}
      style={{
        background: `${cor}${alpha}`,
        color: p >= 0.005 ? "var(--fg)" : "var(--muted)",
        borderLeft: "2px solid var(--bg-card)",
      }}>
      {txt}
    </td>
  );
}

/* ── card de destaque ────────────────────────────────────────── */
function DestaqueCard({
  titulo, icon, zona, times, garantidos, vazio,
}: {
  titulo: string; icon: React.ReactNode; zona: Zona;
  times: TeamSim[]; garantidos: TeamSim[]; vazio: string;
}) {
  const cor = ZONAS[zona].cor;
  return (
    <div className="card flex flex-col gap-3" style={{ borderTop: `3px solid ${cor}` }}>
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--muted)" }}>
        {icon} {titulo}
      </div>
      {garantidos.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap text-xs" style={{ color: "var(--muted)" }}>
          <span>Definidos:</span>
          {garantidos.map(t => (
            <span key={t.clube}
              title={`${t.clube} — ${t.garantido[zona] ? "matematicamente garantido" : `${fmtProb(t, zona).txt} nas simulações`}`}>
              <ClubCrest name={t.clube} size={18} />
            </span>
          ))}
        </div>
      )}
      {times.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--muted)" }}>{vazio}</p>
      ) : (
        <ul className="space-y-2">
          {times.map(t => {
            const p = t.prob[zona];
            return (
              <li key={t.clube} className="text-sm">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <ClubCrest name={t.clube} size={20} />
                    <span className="truncate font-medium" style={{ color: "var(--fg)" }}>{t.clube}</span>
                  </div>
                  <span className="font-bold tabular-nums shrink-0" style={{ color: "var(--fg)" }}>
                    {fmtProb(t, zona).txt}
                  </span>
                </div>
                <div className="h-1.5 rounded-full mt-1 overflow-hidden" style={{ background: "var(--bg-hover)" }}>
                  <div className="h-full rounded-full" style={{ width: `${Math.max(p * 100, 1)}%`, background: cor }} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/* ── page ────────────────────────────────────────────────────── */
export default function ProbabilidadesPage() {
  const [sim, setSim]         = useState<SimResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro]       = useState<string | null>(null);

  useEffect(() => {
    getData.partidas()
      .then(p => {
        // deixa o "carregando" pintar antes da simulação (~150 ms)
        setTimeout(() => {
          setSim(simularTemporada(p));
          setLoading(false);
        }, 0);
      })
      .catch(e => { setErro(String(e)); setLoading(false); });
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center py-32 text-sm" style={{ color: "var(--muted)" }}>
      Simulando o restante do campeonato...
    </div>
  );
  if (erro || !sim) return (
    <div className="text-center py-32 text-sm" style={{ color: "var(--red)" }}>
      {erro ?? "Sem dados para simular."}
    </div>
  );

  const { times, temporada, jogosRestantes, ultimaRodada, nSims } = sim;
  const nT = times.length;
  const encerrado = jogosRestantes === 0;
  const incerto = (z: Zona, min = 0.005) =>
    times.filter(t => !t.garantido[z] && !t.eliminado[z] && t.prob[z] >= min && t.prob[z] <= 0.995)
         .sort((a, b) => b.prob[z] - a.prob[z]);
  const certos = (z: Zona) =>
    times.filter(t => t.garantido[z] || (t.prob[z] > 0.995 && !t.eliminado[z]));

  return (
    <div className="space-y-6">
      {/* header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center"
            style={{ background: "rgba(61,124,245,.15)", border: "1px solid rgba(61,124,245,.3)" }}>
            <Percent size={18} style={{ color: "var(--accent)" }} />
          </div>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: "var(--fg)" }}>
              Probabilidades · Brasileirão {temporada}
            </h1>
            <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>
              {nSims.toLocaleString("pt-BR")} campeonatos simulados · {jogosRestantes} jogos restantes ·
              dados até a rodada {ultimaRodada}
            </p>
          </div>
        </div>
        <Link href="/rodada" className="text-xs px-3 py-1.5 rounded-lg self-start sm:self-auto"
          style={{ background: "var(--bg-card)", color: "var(--muted)", border: "1px solid var(--border)" }}>
          Probabilidades da próxima rodada →
        </Link>
      </div>

      {encerrado && (
        <div className="card-sm text-sm" style={{ color: "var(--muted)" }}>
          A temporada {temporada} está encerrada — as probabilidades abaixo refletem a classificação final.
        </div>
      )}

      {/* destaques */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <DestaqueCard titulo="Título" zona="titulo" icon={<Trophy size={14} style={{ color: ZONAS.titulo.cor }} />}
          times={incerto("titulo", 0.001).slice(0, 5)} garantidos={certos("titulo")}
          vazio="Campeão já definido." />
        <DestaqueCard titulo="Libertadores (G6)" zona="libertadores" icon={<Star size={14} style={{ color: ZONAS.libertadores.cor }} />}
          times={incerto("libertadores").slice(0, 6)} garantidos={certos("libertadores")}
          vazio="Vagas já definidas." />
        <DestaqueCard titulo="Sul-Americana (7º–12º)" zona="sula" icon={<Globe2 size={14} style={{ color: ZONAS.sula.cor }} />}
          times={incerto("sula").slice(0, 6)} garantidos={[]}
          vazio="Vagas já definidas." />
        <DestaqueCard titulo="Rebaixamento (Z4)" zona="rebaixamento" icon={<ShieldAlert size={14} style={{ color: ZONAS.rebaixamento.cor }} />}
          times={incerto("rebaixamento").slice(0, 6)} garantidos={certos("rebaixamento")}
          vazio="Rebaixados já definidos." />
      </div>

      {/* tabela principal */}
      <div className="card overflow-x-auto">
        <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--fg)" }}>
          Chances por clube
        </h2>
        <table className="table-auto w-full text-sm">
          <thead>
            <tr>
              <th className="w-8">#</th>
              <th className="text-left pl-2 min-w-[150px]">Clube</th>
              <th title="Pontos atuais">Pts</th>
              <th title="Jogos disputados">J</th>
              <th title="Saldo de gols" className="hidden sm:table-cell">SG</th>
              <th title="Pontos esperados ao fim do campeonato">Proj.</th>
              <th title="Posição final média" className="hidden md:table-cell">Pos. méd.</th>
              <th>Título</th>
              <th className="hidden sm:table-cell" title="Fase de grupos direta (1º–4º)">G4</th>
              <th title="1º–6º (vagas podem aumentar via Copa do Brasil/Libertadores)">Libertadores</th>
              <th title="7º–12º">Sul-Americana</th>
              <th title="17º–20º">Rebaixamento</th>
            </tr>
          </thead>
          <tbody>
            {times.map(t => {
              const zona = zonaDaPosicao(t.posAtual);
              return (
                <tr key={t.clube}>
                  <td className="text-center text-xs font-semibold"
                    style={{ color: "var(--muted)", boxShadow: zona ? `inset 3px 0 0 ${ZONAS[zona].cor}` : undefined }}>
                    {t.posAtual}
                  </td>
                  <td className="pl-2">
                    <div className="flex items-center gap-2">
                      <ClubCrest name={t.clube} size={20} />
                      <Link href={`/times/${encodeURIComponent(t.clube)}`}
                        className="hover:underline font-medium" style={{ color: "var(--fg)" }}>
                        {t.clube}
                      </Link>
                    </div>
                  </td>
                  <td className="text-center font-bold" style={{ color: "var(--fg)" }}>{t.pts}</td>
                  <td className="text-center" style={{ color: "var(--muted)" }}>{t.j}</td>
                  <td className="text-center hidden sm:table-cell" style={{ color: "var(--muted)" }}>
                    {t.sg > 0 ? "+" : ""}{t.sg}
                  </td>
                  <td className="text-center tabular-nums" style={{ color: "var(--fg)" }}
                    title={`Máximo possível: ${t.ptsMax} pts`}>
                    {Math.round(t.ptsEsperados)}
                  </td>
                  <td className="text-center tabular-nums hidden md:table-cell" style={{ color: "var(--muted)" }}>
                    {nf1.format(t.posMedia)}
                  </td>
                  <ProbCell t={t} z="titulo" />
                  <ProbCell t={t} z="g4" className="hidden sm:table-cell" />
                  <ProbCell t={t} z="libertadores" />
                  <ProbCell t={t} z="sula" />
                  <ProbCell t={t} z="rebaixamento" />
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-xs" style={{ color: "var(--muted)" }}>
          <span>✓ = matematicamente garantido</span>
          <span>– = matematicamente impossível</span>
          <span>Proj. = pontos esperados ao fim do campeonato</span>
        </div>
      </div>

      {/* heatmap posição final */}
      <div className="card overflow-x-auto">
        <h2 className="text-sm font-semibold mb-1" style={{ color: "var(--fg)" }}>
          Distribuição da posição final
        </h2>
        <p className="text-xs mb-3" style={{ color: "var(--muted)" }}>
          Percentual das simulações em que cada clube termina em cada posição. Passe o mouse para ver o valor exato.
        </p>
        <table className="w-full text-xs" style={{ borderCollapse: "separate", borderSpacing: 2 }}>
          <thead>
            <tr>
              <th className="text-left font-semibold pb-1 pr-2" style={{ color: "var(--muted)" }}>Clube</th>
              {Array.from({ length: nT }, (_, k) => {
                const z = zonaDaPosicao(k + 1);
                return (
                  <th key={k} className="font-semibold pb-1 min-w-[30px]"
                    style={{ color: "var(--muted)", borderBottom: `2px solid ${z ? ZONAS[z].cor : "var(--border)"}` }}>
                    {k + 1}º
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {times.map(t => (
              <tr key={t.clube}>
                <td className="pr-2 py-0.5 whitespace-nowrap">
                  <div className="flex items-center gap-1.5">
                    <ClubCrest name={t.clube} size={16} />
                    <span style={{ color: "var(--fg)" }}>{t.clube}</span>
                  </div>
                </td>
                {t.posDist.map((p, k) => {
                  const atual = k + 1 === t.posAtual;
                  const label = p === 0 ? "" : p < 0.005 ? "·" : String(Math.round(p * 100));
                  return (
                    <td key={k}
                      title={`${t.clube} terminar em ${k + 1}º: ${p === 0 ? "0" : p < 0.001 ? "<0,1" : nf1.format(p * 100)}%`}
                      className="text-center tabular-nums rounded"
                      style={{
                        height: 26,
                        background: p > 0 ? `rgba(61,124,245,${0.08 + 0.85 * Math.sqrt(p)})` : "var(--bg-hover)",
                        color: p >= 0.25 ? "#fff" : "var(--muted)",
                        fontWeight: p >= 0.25 ? 700 : 400,
                        outline: atual ? "1px solid var(--fg)" : undefined,
                        outlineOffset: -1,
                      }}>
                      {label}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-xs mt-2" style={{ color: "var(--muted)" }}>
          Contorno branco = posição atual · “·” = menos de 0,5%
        </p>
      </div>

      {/* metodologia */}
      <details className="card text-sm" style={{ color: "var(--muted)" }}>
        <summary className="cursor-pointer font-semibold flex items-center gap-2" style={{ color: "var(--fg)" }}>
          <Info size={14} /> Como as probabilidades são calculadas
        </summary>
        <ul className="list-disc pl-5 mt-3 space-y-1.5">
          <li>
            Cada clube recebe uma força de <strong>ataque</strong> e de <strong>defesa</strong> estimada a partir dos gols
            marcados e sofridos na temporada, ajustados pela força dos adversários (modelo de Poisson).
          </li>
          <li>
            Jogos recentes pesam mais (meia-vida de 12 rodadas). No início do campeonato a força parte do desempenho da
            temporada anterior; clubes recém-promovidos começam abaixo da média.
          </li>
          <li>
            Os {jogosRestantes} jogos restantes são sorteados {nSims.toLocaleString("pt-BR")} vezes, com mando de campo
            (média de {nf1.format(sim.mediaCasa)} gols do mandante × {nf1.format(sim.mediaFora)} do visitante) e uma margem de
            incerteza sobre a força de cada time, maior quanto mais jogos faltam.
          </li>
          <li>Desempate: pontos, vitórias, saldo de gols e gols pró (demais critérios por sorteio).</li>
          <li>
            Zonas consideradas: título (1º), Libertadores (1º–6º, sendo 1º–4º direto na fase de grupos), Sul-Americana
            (7º–12º) e rebaixamento (17º–20º). As vagas continentais podem aumentar se clubes do G6 vencerem a Copa do
            Brasil ou a Libertadores.
          </li>
          <li>Os valores ✓/– são verificados matematicamente pelos pontos máximos ainda possíveis.</li>
        </ul>
        <p className="mt-3 text-xs">Modelo estatístico — não constitui previsão garantida.</p>
      </details>
    </div>
  );
}
