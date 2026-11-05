// Simulação Monte Carlo do restante do campeonato.
//
// Modelo:
//   1. Força de cada clube = ataque (gols marcados) e defesa (gols sofridos),
//      ajustados pelo adversário (modelo de Poisson tipo Maher/Dixon-Coles).
//   2. Os jogos da temporada atual pesam mais quanto mais recentes
//      (meia-vida de HALF_LIFE rodadas).
//   3. Regularização bayesiana: cada clube começa com PRIOR_GAMES "jogos
//      fictícios" no nível da temporada anterior (encolhida para a média);
//      clubes recém-promovidos começam abaixo da média. Isso estabiliza o
//      início do campeonato e some à medida que a temporada avança.
//   4. Cada simulação sorteia uma perturbação na força de cada time
//      (incerteza do modelo — maior no início da temporada) e depois sorteia o placar de cada jogo
//      restante via Poisson.
//   5. Desempate CBF: pontos > vitórias > saldo > gols pró (demais critérios
//      — confronto direto, cartões, sorteio — viram sorteio aleatório).

import type { Partida } from "@/lib/data";

export const N_SIMS       = 10_000;
const HALF_LIFE           = 12;     // rodadas
const PRIOR_GAMES         = 8;      // jogos fictícios de regularização
const PREV_SEASON_KEEP    = 0.7;    // quanto da força da temporada anterior é mantida no prior
const PROMOVIDO_ATT       = 0.85;
const PROMOVIDO_DEF       = 1.15;
const SIGMA_MIN           = 0.06;   // incerteza da força por simulação (log-normal) no fim da temporada
const SIGMA_MAX           = 0.24;   // ... e no início (força real ainda pouco conhecida)
const DEFAULT_HOME_GOALS  = 1.45;
const DEFAULT_AWAY_GOALS  = 1.05;

/* ── zonas de classificação (Série A, 20 clubes) ─────────────── */
export const ZONAS = {
  titulo:       { de: 1,  ate: 1,  label: "Título",        cor: "#f5c518" },
  g4:           { de: 1,  ate: 4,  label: "G4",            cor: "#00d25b" },
  libertadores: { de: 1,  ate: 6,  label: "Libertadores",  cor: "#00d25b" },
  sula:         { de: 7,  ate: 12, label: "Sul-Americana", cor: "#3d7cf5" },
  rebaixamento: { de: 17, ate: 20, label: "Rebaixamento",  cor: "#e94560" },
} as const;
export type Zona = keyof typeof ZONAS;

export type Ratings = Map<string, { att: number; def: number }>;

export type TeamSim = {
  clube: string;
  posAtual: number;
  pts: number; j: number; v: number; e: number; d: number;
  gp: number; gc: number; sg: number;
  restantes: number;
  ptsMax: number;
  ptsEsperados: number;
  posMedia: number;
  posDist: number[];                 // fração das simulações em cada posição (índice 0 = 1º)
  prob: Record<Zona, number>;        // 0..1
  garantido: Partial<Record<Zona, boolean>>;  // matematicamente garantido
  eliminado: Partial<Record<Zona, boolean>>;  // matematicamente impossível
  att: number; def: number;
};

export type SimResult = {
  temporada: number;
  times: TeamSim[];
  jogosRestantes: number;
  jogosDisputados: number;
  ultimaRodada: number;
  nSims: number;
  mediaCasa: number;
  mediaFora: number;
};

/* ── PRNG determinística (resultados estáveis entre recargas) ─── */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function poisson(lambda: number, rnd: () => number) {
  const L = Math.exp(-lambda);
  let k = 0, p = 1;
  do { k++; p *= rnd(); } while (p > L);
  return k - 1;
}

function gaussian(rnd: () => number) {
  const u = Math.max(rnd(), 1e-12), v = rnd();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

const jogado = (p: Partida) => p.gols_mandante !== null && p.gols_visitante !== null;

/* ── ajuste de ataque/defesa ─────────────────────────────────── */
export function fitRatings(
  jogos: Partida[],
  times: string[],
  prior: Ratings,
  halfLife: number | null,
): { ratings: Ratings; mediaCasa: number; mediaFora: number } {
  const played = jogos.filter(jogado);
  const ultima = played.reduce((m, p) => Math.max(m, p.rodada), 0);
  const peso = (p: Partida) => halfLife ? Math.pow(0.5, (ultima - p.rodada) / halfLife) : 1;

  // médias da liga (casa/fora), também regularizadas
  let wSum = 0, hSum = 0, aSum = 0;
  for (const p of played) {
    const w = peso(p);
    wSum += w; hSum += w * p.gols_mandante!; aSum += w * p.gols_visitante!;
  }
  const K = 20;
  const mediaCasa = (hSum + K * DEFAULT_HOME_GOALS) / (wSum + K);
  const mediaFora = (aSum + K * DEFAULT_AWAY_GOALS) / (wSum + K);

  const r: Ratings = new Map();
  for (const t of times) r.set(t, { ...(prior.get(t) ?? { att: 1, def: 1 }) });

  for (let it = 0; it < 60; it++) {
    const num = new Map<string, { a: number; ae: number; d: number; de: number }>();
    for (const t of times) {
      const pr = prior.get(t) ?? { att: 1, def: 1 };
      // prior: PRIOR_GAMES jogos "médios" contra um adversário neutro
      const base = (mediaCasa + mediaFora) / 2 * PRIOR_GAMES;
      num.set(t, { a: base * pr.att, ae: base, d: base * pr.def, de: base });
    }
    for (const p of played) {
      const h = r.get(p.mandante), a = r.get(p.visitante);
      if (!h || !a) continue;
      const w = peso(p);
      const nh = num.get(p.mandante)!, na = num.get(p.visitante)!;
      nh.a  += w * p.gols_mandante!;  nh.ae += w * mediaCasa * a.def;
      na.a  += w * p.gols_visitante!; na.ae += w * mediaFora * h.def;
      nh.d  += w * p.gols_visitante!; nh.de += w * mediaFora * a.att;
      na.d  += w * p.gols_mandante!;  na.de += w * mediaCasa * h.att;
    }
    let sa = 0, sd = 0;
    for (const t of times) {
      const n = num.get(t)!;
      const v = { att: n.a / n.ae, def: n.d / n.de };
      r.set(t, v); sa += v.att; sd += v.def;
    }
    // normaliza média = 1 (identificabilidade)
    const ma = sa / times.length, md = sd / times.length;
    for (const t of times) { const v = r.get(t)!; v.att /= ma; v.def /= md; }
  }
  return { ratings: r, mediaCasa, mediaFora };
}

/* ── tabela atual ────────────────────────────────────────────── */
type Linha = { pts: number; v: number; e: number; d: number; gp: number; gc: number; j: number };

function tabela(jogos: Partida[], times: string[]) {
  const t = new Map<string, Linha>();
  for (const c of times) t.set(c, { pts: 0, v: 0, e: 0, d: 0, gp: 0, gc: 0, j: 0 });
  for (const p of jogos) {
    if (!jogado(p)) continue;
    const h = t.get(p.mandante)!, a = t.get(p.visitante)!;
    const gm = p.gols_mandante!, gv = p.gols_visitante!;
    h.j++; a.j++; h.gp += gm; h.gc += gv; a.gp += gv; a.gc += gm;
    if (gm > gv) { h.v++; h.pts += 3; a.d++; }
    else if (gm < gv) { a.v++; a.pts += 3; h.d++; }
    else { h.e++; a.e++; h.pts++; a.pts++; }
  }
  return t;
}

function ordenar(times: string[], t: Map<string, Linha>) {
  return [...times].sort((x, y) => {
    const a = t.get(x)!, b = t.get(y)!;
    return b.pts - a.pts || b.v - a.v || (b.gp - b.gc) - (a.gp - a.gc) || b.gp - a.gp || x.localeCompare(y);
  });
}

/* ── simulação ───────────────────────────────────────────────── */
export function simularTemporada(todas: Partida[], temporada?: number, nSims = N_SIMS): SimResult | null {
  const ano = temporada ?? todas.reduce((m, p) => Math.max(m, p.temporada), 0);
  const jogos = todas.filter(p => p.temporada === ano);
  if (!jogos.length) return null;
  const times = [...new Set(jogos.flatMap(p => [p.mandante, p.visitante]))].sort();
  const nT = times.length;

  // prior a partir da temporada anterior
  const anteriores = todas.filter(p => p.temporada === ano - 1);
  const prior: Ratings = new Map();
  if (anteriores.length) {
    const timesAnt = [...new Set(anteriores.flatMap(p => [p.mandante, p.visitante]))];
    const { ratings: prev } = fitRatings(anteriores, timesAnt, new Map(), null);
    for (const t of times) {
      const pv = prev.get(t);
      prior.set(t, pv
        ? { att: 1 + (pv.att - 1) * PREV_SEASON_KEEP, def: 1 + (pv.def - 1) * PREV_SEASON_KEEP }
        : { att: PROMOVIDO_ATT, def: PROMOVIDO_DEF });
    }
  }

  const { ratings, mediaCasa, mediaFora } = fitRatings(jogos, times, prior, HALF_LIFE);
  const atual = tabela(jogos, times);
  const ordemAtual = ordenar(times, atual);
  const restantes = jogos.filter(p => !jogado(p));

  const idx = new Map(times.map((t, i) => [t, i]));
  const rest = restantes.map(p => [idx.get(p.mandante)!, idx.get(p.visitante)!] as const);
  const baseAtt = times.map(t => ratings.get(t)!.att);
  const baseDef = times.map(t => ratings.get(t)!.def);
  const basePts = times.map(t => atual.get(t)!.pts);
  const baseV   = times.map(t => atual.get(t)!.v);
  const baseSg  = times.map(t => atual.get(t)!.gp - atual.get(t)!.gc);
  const baseGp  = times.map(t => atual.get(t)!.gp);

  const posCount = times.map(() => new Array(nT).fill(0) as number[]);
  const ptsSum = new Array(nT).fill(0);
  // incerteza da força diminui à medida que a temporada avança
  const sigma = SIGMA_MIN + (SIGMA_MAX - SIGMA_MIN) * (restantes.length / jogos.length);
  const rnd = mulberry32(20260101 + ano + restantes.length * 7919);

  const pts = new Array(nT), v = new Array(nT), sg = new Array(nT), gp = new Array(nT);
  const att = new Array(nT), def = new Array(nT), tie = new Array(nT);
  const order = times.map((_, i) => i);

  for (let s = 0; s < nSims; s++) {
    for (let i = 0; i < nT; i++) {
      pts[i] = basePts[i]; v[i] = baseV[i]; sg[i] = baseSg[i]; gp[i] = baseGp[i];
      att[i] = baseAtt[i] * Math.exp(sigma * gaussian(rnd));
      def[i] = baseDef[i] * Math.exp(sigma * gaussian(rnd));
      tie[i] = rnd();
    }
    for (const [h, a] of rest) {
      const gh = poisson(mediaCasa * att[h] * def[a], rnd);
      const ga = poisson(mediaFora * att[a] * def[h], rnd);
      gp[h] += gh; gp[a] += ga; sg[h] += gh - ga; sg[a] += ga - gh;
      if (gh > ga) { pts[h] += 3; v[h]++; }
      else if (gh < ga) { pts[a] += 3; v[a]++; }
      else { pts[h]++; pts[a]++; }
    }
    order.sort((x, y) => pts[y] - pts[x] || v[y] - v[x] || sg[y] - sg[x] || gp[y] - gp[x] || tie[y] - tie[x]);
    for (let pos = 0; pos < nT; pos++) {
      const t = order[pos];
      posCount[t][pos]++;
      ptsSum[t] += pts[t];
    }
  }

  // pontos máximos possíveis para checagens matemáticas
  const jogosRest = new Array(nT).fill(0);
  for (const [h, a] of rest) { jogosRest[h]++; jogosRest[a]++; }
  const ptsMax = basePts.map((p, i) => p + 3 * jogosRest[i]);

  const timesSim: TeamSim[] = times.map((clube, i) => {
    const dist = posCount[i].map(c => c / nSims);
    const faixa = (de: number, ate: number) => dist.slice(de - 1, ate).reduce((a, b) => a + b, 0);
    const prob = Object.fromEntries(
      (Object.keys(ZONAS) as Zona[]).map(z => [z, faixa(ZONAS[z].de, ZONAS[z].ate)])
    ) as Record<Zona, number>;

    // Garantido: menos de `ate` outros clubes ainda conseguem igualar/passar.
    // Eliminado: pelo menos `ate` outros clubes já têm mais pontos do que o máximo deste.
    // Rebaixamento é zona de baixo: garantido se ≥ (de-1) clubes já não podem ser alcançados.
    const garantido: TeamSim["garantido"] = {};
    const eliminado: TeamSim["eliminado"] = {};
    const outros = times.map((_, j) => j).filter(j => j !== i);
    for (const z of ["titulo", "g4", "libertadores"] as Zona[]) {
      const { ate } = ZONAS[z];
      const ameacas = outros.filter(j => ptsMax[j] >= basePts[i]).length;
      if (ameacas < ate) garantido[z] = true;
      const aFrente = outros.filter(j => basePts[j] > ptsMax[i]).length;
      if (aFrente >= ate) eliminado[z] = true;
    }
    {
      const { de } = ZONAS.rebaixamento;
      const aFrente = outros.filter(j => basePts[j] > ptsMax[i]).length;
      if (aFrente >= de - 1) garantido.rebaixamento = true;
      const abaixo = outros.filter(j => ptsMax[j] < basePts[i]).length;
      if (abaixo >= nT - de + 1) eliminado.rebaixamento = true;
    }

    const l = atual.get(clube)!;
    return {
      clube,
      posAtual: ordemAtual.indexOf(clube) + 1,
      pts: l.pts, j: l.j, v: l.v, e: l.e, d: l.d, gp: l.gp, gc: l.gc, sg: l.gp - l.gc,
      restantes: jogosRest[i],
      ptsMax: ptsMax[i],
      ptsEsperados: ptsSum[i] / nSims,
      posMedia: dist.reduce((a, p, k) => a + p * (k + 1), 0),
      posDist: dist,
      prob, garantido, eliminado,
      att: baseAtt[i], def: baseDef[i],
    };
  }).sort((a, b) => a.posAtual - b.posAtual);

  return {
    temporada: ano,
    times: timesSim,
    jogosRestantes: restantes.length,
    jogosDisputados: jogos.length - restantes.length,
    ultimaRodada: jogos.filter(jogado).reduce((m, p) => Math.max(m, p.rodada), 0),
    nSims,
    mediaCasa, mediaFora,
  };
}
