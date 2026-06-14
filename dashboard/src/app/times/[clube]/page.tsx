"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getData, type DesempenhoClube, type Partida } from "@/lib/data";
import { fmt } from "@/lib/utils";
import { getClubColor } from "@/lib/clubs";
import ClubCrest from "@/components/ClubCrest";
import { ChevronLeft } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

const tooltipStyle = {
  contentStyle: { background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--fg)" },
  labelStyle:   { color: "var(--muted)", fontSize: 11 },
};

export default function TimePage() {
  const { clube } = useParams<{ clube: string }>();
  const nome  = decodeURIComponent(clube);
  const color = getClubColor(nome);

  const [desempenho, setDesempenho] = useState<DesempenhoClube[]>([]);
  const [partidas, setPartidas]     = useState<Partida[]>([]);
  const [loading, setLoading]       = useState(true);

  useEffect(() => {
    Promise.all([getData.desempenho(), getData.partidas()]).then(([d, p]) => {
      setDesempenho(d.filter(x => x.clube === nome).sort((a, b) => b.temporada - a.temporada));
      setPartidas(
        p.filter(x => (x.mandante === nome || x.visitante === nome) && x.gols_mandante !== null)
         .sort((a, b) => b.temporada - a.temporada || b.rodada - a.rodada)
      );
    }).finally(() => setLoading(false));
  }, [nome]);

  if (loading) return (
    <div className="flex items-center justify-center py-32 text-sm" style={{ color: "var(--muted)" }}>
      Carregando...
    </div>
  );

  const totalJogos = desempenho.reduce((s, d) => s + d.jogos, 0);
  const totalVit   = desempenho.reduce((s, d) => s + d.vitorias, 0);
  const totalEmp   = desempenho.reduce((s, d) => s + d.empates, 0);
  const totalDer   = desempenho.reduce((s, d) => s + d.derrotas, 0);
  const totalGP    = desempenho.reduce((s, d) => s + d.gols_pro, 0);
  const totalGC    = desempenho.reduce((s, d) => s + d.gols_contra, 0);

  const chartData = [...desempenho].reverse().map(d => ({
    ano:   d.temporada,
    aprov: d.jogos ? +((d.pontos / (d.jogos * 3)) * 100).toFixed(1) : 0,
  }));

  const kpis = [
    { label: "Jogos",      value: fmt(totalJogos) },
    { label: "Vitórias",   value: fmt(totalVit),  color: "var(--green)"  },
    { label: "Empates",    value: fmt(totalEmp),  color: "var(--yellow)" },
    { label: "Derrotas",   value: fmt(totalDer),  color: "var(--red)"    },
    { label: "Gols Pro",   value: fmt(totalGP)   },
    { label: "Gols Contr", value: fmt(totalGC)   },
  ];

  return (
    <div className="space-y-5">
      {/* Banner com cor do clube */}
      <div
        className="rounded-xl px-6 py-5 flex items-center gap-4"
        style={{
          background: `linear-gradient(135deg, ${color}22 0%, ${color}08 100%)`,
          border:     `1px solid ${color}33`,
        }}
      >
        <Link href="/times" style={{ color: "var(--muted)" }} className="hover:text-white transition-colors shrink-0">
          <ChevronLeft size={20} />
        </Link>
        <ClubCrest name={nome} size={64} />
        <div>
          <h1 className="text-2xl font-bold" style={{ color: "var(--fg)" }}>{nome}</h1>
          <p className="text-sm mt-0.5" style={{ color }}>
            {desempenho.length} temporadas no Brasileirão
          </p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
        {kpis.map(({ label, value, color: c }) => (
          <div key={label} className="card text-center py-4" style={{ borderColor: `${color}22` }}>
            <div className="text-2xl font-black" style={{ color: c ?? color }}>{value}</div>
            <div className="text-xs mt-1" style={{ color: "var(--muted)" }}>{label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Aproveitamento */}
        <div className="card">
          <h2 className="font-semibold mb-4 text-sm" style={{ color: "var(--fg)" }}>Aproveitamento por Temporada (%)</h2>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="ano" tick={{ fontSize: 10, fill: "var(--muted)" }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "var(--muted)" }} axisLine={false} tickLine={false} />
              <Tooltip {...tooltipStyle} formatter={(v) => [`${v}%`, "Aproveitamento"]} />
              <Line type="monotone" dataKey="aprov" stroke={color} strokeWidth={2} dot={{ r: 3, fill: color, strokeWidth: 0 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Histórico por temporada */}
        <div className="card overflow-auto max-h-72">
          <h2 className="font-semibold mb-3 text-sm" style={{ color: "var(--fg)" }}>Histórico por Temporada</h2>
          <table className="table-auto w-full text-sm">
            <thead>
              <tr><th>Ano</th><th>Pts</th><th>J</th><th>V</th><th>E</th><th>D</th><th>SG</th></tr>
            </thead>
            <tbody>
              {desempenho.map(d => (
                <tr key={d.temporada}>
                  <td>
                    <Link href={`/temporadas/${d.temporada}`}
                      className="hover:underline" style={{ color: "var(--accent)" }}>
                      {d.temporada}
                    </Link>
                  </td>
                  <td className="text-center font-bold" style={{ color }}>{d.pontos}</td>
                  <td className="text-center" style={{ color: "var(--muted)" }}>{d.jogos}</td>
                  <td className="text-center" style={{ color: "var(--green)" }}>{d.vitorias}</td>
                  <td className="text-center" style={{ color: "var(--yellow)" }}>{d.empates}</td>
                  <td className="text-center" style={{ color: "var(--red)" }}>{d.derrotas}</td>
                  <td className="text-center font-medium" style={{ color: "var(--fg)" }}>
                    {d.gols_pro - d.gols_contra >= 0 ? "+" : ""}{d.gols_pro - d.gols_contra}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Últimas partidas */}
      <div className="card">
        <h2 className="font-semibold mb-3 text-sm" style={{ color: "var(--fg)" }}>Últimas Partidas</h2>
        <div className="space-y-1.5">
          {partidas.slice(0, 10).map(p => {
            const isHome = p.mandante === nome;
            const gp  = isHome ? (p.gols_mandante ?? 0) : (p.gols_visitante ?? 0);
            const gc  = isHome ? (p.gols_visitante ?? 0) : (p.gols_mandante ?? 0);
            const res = gp > gc ? "V" : gp === gc ? "E" : "D";
            const resColor = res === "V" ? "var(--green)" : res === "E" ? "var(--yellow)" : "var(--red)";
            const resBg    = res === "V" ? "rgba(0,210,91,.15)" : res === "E" ? "rgba(245,197,24,.12)" : "rgba(233,69,96,.15)";

            return (
              <div key={p.partida_id}
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm"
                style={{ background: "var(--bg-hover)" }}>
                <span className="text-xs font-bold w-6 h-6 flex items-center justify-center rounded shrink-0"
                  style={{ background: resBg, color: resColor }}>{res}</span>
                <span className="text-xs w-20 shrink-0" style={{ color: "var(--muted)" }}>
                  {p.temporada} R{p.rodada}
                </span>
                <div className="flex-1 flex items-center justify-end gap-1.5 min-w-0">
                  <ClubCrest name={p.mandante} size={18} />
                  <span className="font-medium truncate" style={{ color: "var(--fg)" }}>{p.mandante}</span>
                </div>
                <span className="font-black tabular-nums px-2 shrink-0" style={{ color: "var(--fg)" }}>
                  {p.gols_mandante} – {p.gols_visitante}
                </span>
                <div className="flex-1 flex items-center gap-1.5 min-w-0">
                  <ClubCrest name={p.visitante} size={18} />
                  <span className="font-medium truncate" style={{ color: "var(--fg)" }}>{p.visitante}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
