import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function fmt(n: number | null | undefined, decimais = 0) {
  if (n == null) return "—";
  return n.toLocaleString("pt-BR", { maximumFractionDigits: decimais });
}

export function pct(wins: number, total: number) {
  if (!total) return "0%";
  return ((wins / total) * 100).toFixed(1) + "%";
}

export function resultadoCor(gm: number | null, ga: number | null, lado: "m" | "v") {
  if (gm == null || ga == null) return "text-slate-400";
  const ganhou = lado === "m" ? gm > ga : ga > gm;
  const empatou = gm === ga;
  if (ganhou) return "text-green-600 font-bold";
  if (empatou) return "text-yellow-600";
  return "text-red-500";
}

export const SITUACAO_COR: Record<string, string> = {
  "Campeão":       "bg-yellow-100 text-yellow-700 border border-yellow-300",
  "Libertadores":  "bg-green-100 text-green-700 border border-green-300",
  "Sul-Americana": "bg-blue-100 text-blue-700 border border-blue-300",
  "Rebaixado":     "bg-red-100 text-red-700 border border-red-300",
  "Manutenção":    "bg-slate-100 text-slate-600",
};
