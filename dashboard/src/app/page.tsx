"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { getData, type TemporadaMeta, type Campeao } from "@/lib/data";
import { fmt } from "@/lib/utils";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid,
} from "recharts";
import { Trophy, Layers, Goal, Shirt, TrendingUp } from "lucide-react";

function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card flex flex-col gap-1">
      <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "var(--muted)" }}>{label}</span>
      <span className="text-3xl font-bold" style={{ color: "var(--fg)" }}>{value}</span>
      {sub && <span className="text-xs" style={{ color: "var(--muted)" }}>{sub}</span>}
    </div>
  );
}

const tooltipStyle = {
  contentStyle: { background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 8, color: "var(--fg)" },
  labelStyle:   { color: "var(--muted)", fontSize: 11 },
  itemStyle:    { color: "var(--accent)" },
};

export default function Home() {
  const [metas, setMetas]       = useState<TemporadaMeta[]>([]);
  const [campeoes, setCampeoes] = useState<Campeao[]>([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    Promise.all([getData.temporadasMeta(), getData.campeoes()])
      .then(([m, c]) => { setMetas(m); setCampeoes(c); })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center py-32 text-sm" style={{ color: "var(--muted)" }}>
      Carregando...
    </div>
  );

  const totalPartidas = metas.reduce((s, m) => s + m.total_partidas, 0);
  const totalGols     = metas.reduce((s, m) => s + (m.total_gols || 0), 0);
  const totalTemps    = metas.length;
  const mediaGols     = (totalGols / totalPartidas).toFixed(2);

  const titulos: Record<string, number> = {};
  campeoes.forEach(c => { titulos[c.clube] = (titulos[c.clube] || 0) + 1; });
  const ranking = Object.entries(titulos).sort((a, b) => b[1] - a[1]).slice(0, 8);

  const chartGols = [...metas].reverse().map(m => ({
    ano: m.temporada,
    gols: m.total_gols,
    media: m.total_partidas ? +(m.total_gols / m.total_partidas).toFixed(2) : 0,
  }));

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Temporadas"      value={fmt(totalTemps)}    sub="2003 – 2026" />
        <KpiCard label="Partidas"        value={fmt(totalPartidas)} sub="todas as edicoes" />
        <KpiCard label="Gols"            value={fmt(totalGols)}     sub="com detalhes" />
        <KpiCard label="Media Gols/Jogo" value={mediaGols}          sub="historico geral" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* gráfico gols */}
        <div className="card lg:col-span-2">
          <h2 className="font-semibold mb-4 flex items-center gap-2" style={{ color: "var(--fg)" }}>
            <TrendingUp size={16} style={{ color: "var(--accent)" }} /> Gols por Temporada
          </h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartGols} barSize={12}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="ano" tick={{ fontSize: 11, fill: "var(--muted)" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "var(--muted)" }} axisLine={false} tickLine={false} />
              <Tooltip {...tooltipStyle} formatter={(v: any) => [fmt(Number(v)), "Gols"]} />
              <Bar dataKey="gols" fill="var(--accent)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* maiores campeões */}
        <div className="card">
          <h2 className="font-semibold mb-4 flex items-center gap-2" style={{ color: "var(--fg)" }}>
            <Trophy size={15} style={{ color: "var(--yellow)" }} /> Maiores Campeoes
          </h2>
          <ul className="space-y-2.5">
            {ranking.map(([clube, t], i) => (
              <li key={clube} className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs w-4 text-right" style={{ color: "var(--muted)" }}>{i + 1}</span>
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                    style={{ background: "var(--accent-2)" }}>
                    {clube.slice(0, 1)}
                  </div>
                  <Link href={`/times/${encodeURIComponent(clube)}`}
                    className="text-sm font-medium hover:underline" style={{ color: "var(--fg)" }}>
                    {clube}
                  </Link>
                </div>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full shrink-0"
                  style={{ background: "rgba(245,197,24,.12)", color: "var(--yellow)" }}>
                  {t} {t === 1 ? "titulo" : "titulos"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* média gols */}
      <div className="card">
        <h2 className="font-semibold mb-4" style={{ color: "var(--fg)" }}>
          Media de Gols por Jogo — historico
        </h2>
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={chartGols}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="ano" tick={{ fontSize: 11, fill: "var(--muted)" }} axisLine={false} tickLine={false} />
            <YAxis domain={[1.5, 3.5]} tick={{ fontSize: 11, fill: "var(--muted)" }} axisLine={false} tickLine={false} />
            <Tooltip {...tooltipStyle} formatter={(v: any) => [v, "Gols/jogo"]} />
            <Line type="monotone" dataKey="media" stroke="var(--green)" strokeWidth={2}
              dot={{ r: 3, fill: "var(--green)", strokeWidth: 0 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* atalhos */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { href: "/temporadas/2026", label: "Temporada 2026", desc: "Em andamento",      icon: Layers, color: "var(--accent)" },
          { href: "/temporadas/2024", label: "Campeao 2024",   desc: "Botafogo",           icon: Trophy, color: "var(--yellow)" },
          { href: "/times",           label: "Todos os Times", desc: "Perfis e historico", icon: Shirt,  color: "var(--green)" },
          { href: "/consultas",       label: "Consultas SQL",  desc: "Explore os dados",   icon: Goal,   color: "#b388ff" },
        ].map(({ href, label, desc, icon: Icon, color }) => (
          <Link key={href} href={href}
            className="card flex flex-col gap-2 cursor-pointer transition-all hover:scale-[1.02]"
            style={{ borderColor: "var(--border)" }}>
            <Icon size={20} style={{ color }} />
            <span className="font-semibold text-sm" style={{ color: "var(--fg)" }}>{label}</span>
            <span className="text-xs" style={{ color: "var(--muted)" }}>{desc}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
