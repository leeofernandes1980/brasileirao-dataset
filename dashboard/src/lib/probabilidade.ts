import type { Partida } from "@/lib/data";

export const DECAY = 0.82;
export const STR_W = 0.25;

export const ELENCO_CONFIG = {
  titular: { formN: 5,  h2hW: 0.55, label: "Titular",  desc: "Confia mais na forma atual" },
  misto:   { formN: 8,  h2hW: 0.70, label: "Misto",    desc: "Balanco historico + forma"  },
  reserva: { formN: 12, h2hW: 0.82, label: "Reserva",  desc: "Prioriza historico e H2H"   },
} as const;
export type Elenco = keyof typeof ELENCO_CONFIG;
export type Mando  = "todos" | "t1_casa" | "t2_casa";

export type StrengthResult = {
  score:      number;
  lastYear:   number;
  ptsPerGame: number;
  games:      number;
  warning:    string;
  stars:      number;
};

export type ProbResult = {
  t1: number; draw: number; t2: number;
  vit1: number; emps: number; vit2: number; total: number;
  h2h: { pct1: number; pctDraw: number; pct2: number; totalW: number };
};

export type FormResult = {
  wins: number; draws: number; losses: number;
  results: ("V" | "E" | "D")[];
  details: { res: "V"|"E"|"D"; opp: string; gp: number; gc: number; temp: number; rod: number }[];
  n: number;
};

export type HomeAwayStats = {
  homePct: number; awayPct: number;
  homeDrawPct: number; awayDrawPct: number;
  homeW: number; homeD: number; homeL: number;
  awayW: number; awayD: number; awayL: number;
  homeTotal: number; awayTotal: number;
};

export function homeAwayStats(partidas: Partida[], team: string, maxYear: number): HomeAwayStats {
  const home = partidas.filter(p => p.mandante === team);
  const away = partidas.filter(p => p.visitante === team);
  let homeW=0, homeD=0, homeL=0, awayW=0, awayD=0, awayL=0, homeTot=0, awayTot=0;
  for (const p of home) {
    const w = Math.pow(DECAY, maxYear - p.temporada);
    const gm=p.gols_mandante??0, gv=p.gols_visitante??0;
    if(gm>gv) homeW+=w; else if(gm===gv) homeD+=w; else homeL+=w;
    homeTot+=w;
  }
  for (const p of away) {
    const w = Math.pow(DECAY, maxYear - p.temporada);
    const gm=p.gols_mandante??0, gv=p.gols_visitante??0;
    if(gv>gm) awayW+=w; else if(gm===gv) awayD+=w; else awayL+=w;
    awayTot+=w;
  }
  const ht = Math.max(homeTot, 0.001), at = Math.max(awayTot, 0.001);
  return {
    homePct:     +(homeW/ht*100).toFixed(1),
    awayPct:     +(awayW/at*100).toFixed(1),
    homeDrawPct: +(homeD/ht*100).toFixed(1),
    awayDrawPct: +(awayD/at*100).toFixed(1),
    homeW: Math.round(homeW), homeD: Math.round(homeD), homeL: Math.round(homeL),
    awayW: Math.round(awayW), awayD: Math.round(awayD), awayL: Math.round(awayL),
    homeTotal: home.length, awayTotal: away.length,
  };
}

export function recentFormN(partidas: Partida[], team: string, n: number): FormResult {
  const jogos = partidas
    .filter(p => p.mandante === team || p.visitante === team)
    .sort((a, b) => b.temporada - a.temporada || b.rodada - a.rodada)
    .slice(0, n);
  let wins=0, draws=0, losses=0;
  const results: ("V"|"E"|"D")[] = [];
  const details: FormResult["details"] = [];
  for (const p of jogos) {
    const gm=p.gols_mandante??0, gv=p.gols_visitante??0;
    const isHome = p.mandante===team;
    const gp=isHome?gm:gv, gc=isHome?gv:gm;
    const opp=isHome?p.visitante:p.mandante;
    let r: "V"|"E"|"D" = "E";
    if(gp>gc){r="V";wins++;}else if(gp<gc){r="D";losses++;}else draws++;
    results.push(r);
    details.push({ res:r, opp, gp, gc, temp:p.temporada, rod:p.rodada });
  }
  return { wins, draws, losses, results, details, n: jogos.length };
}

function weightedH2H(games: Partida[], time1: string, maxYear: number) {
  let wWin1=0, wWin2=0, wDraw=0;
  for (const p of games) {
    const w = Math.pow(DECAY, maxYear - p.temporada);
    const gm=p.gols_mandante??0, gv=p.gols_visitante??0;
    const t1Home = p.mandante === time1;
    const gp=t1Home?gm:gv, gc=t1Home?gv:gm;
    if(gp>gc) wWin1+=w; else if(gp<gc) wWin2+=w; else wDraw+=w;
  }
  const total = wWin1+wWin2+wDraw||1;
  return { pct1: wWin1/total, pct2: wWin2/total, pctDraw: wDraw/total, totalW: total };
}

export function teamStrength(allPartidas: Partida[], team: string, maxYear: number): StrengthResult {
  const teamGames = allPartidas.filter(p =>
    (p.mandante===team||p.visitante===team) && p.gols_mandante!==null
  );
  if(!teamGames.length) return { score:0.3, lastYear:0, ptsPerGame:0, games:0, warning:"Sem dados", stars:1 };
  const lastYear    = Math.max(...teamGames.map(p => p.temporada));
  const seasonGames = teamGames.filter(p => p.temporada===lastYear);
  let pts=0;
  for(const p of seasonGames) {
    const gm=p.gols_mandante??0, gv=p.gols_visitante??0;
    const gp=p.mandante===team?gm:gv, gc=p.mandante===team?gv:gm;
    if(gp>gc) pts+=3; else if(gp===gc) pts+=1;
  }
  const ptsPerGame = seasonGames.length ? pts/seasonGames.length : 0;
  const baseScore  = Math.min(ptsPerGame/3, 1);
  const gap  = maxYear - lastYear;
  const rec  = gap===0?1:gap===1?.82:gap===2?.60:gap===3?.42:.28;
  const score = baseScore*rec;
  const warning = gap===0?"":gap===1?`Última temp. Série A: ${lastYear}`:`Fora da Série A desde ${lastYear}`;
  const stars = score>=.75?5:score>=.58?4:score>=.42?3:score>=.25?2:1;
  return { score, lastYear, ptsPerGame:+ptsPerGame.toFixed(2), games:seasonGames.length, warning, stars };
}

export function calcProb(
  confrontos: Partida[],
  time1: string, time2: string,
  form1: FormResult, form2: FormResult,
  mando: Mando,
  elenco: Elenco,
  stats1: HomeAwayStats, stats2: HomeAwayStats,
  str1: StrengthResult, str2: StrengthResult,
  maxYear: number,
): ProbResult | null {
  const { h2hW } = ELENCO_CONFIG[elenco];
  const total = confrontos.length;
  if(!total) return null;

  const h2h  = weightedH2H(confrontos, time1, maxYear);
  const tot1 = Math.max(form1.wins+form1.draws+form1.losses, 1);
  const tot2 = Math.max(form2.wins+form2.draws+form2.losses, 1);
  const baseW = 1-STR_W, h2hWf = h2hW*baseW, formWf = (1-h2hW)*baseW;

  let t1  = h2h.pct1   *h2hWf*100 + (form1.wins/tot1) *100*formWf;
  let dr  = h2h.pctDraw*h2hWf*100 + ((form1.draws/tot1+form2.draws/tot2)/2)*100*formWf;
  let t2  = h2h.pct2   *h2hWf*100 + (form2.wins/tot2) *100*formWf;

  const strTotal = str1.score+str2.score||.001;
  const strShift = (str1.score/strTotal-.5)*2*STR_W*100;
  t1+=strShift; t2-=strShift;

  const mandoW = 0.25;
  if(mando==="t1_casa") {
    t1=t1*(1-mandoW)+stats1.homePct*mandoW;
    t2=t2*(1-mandoW)+stats2.awayPct*mandoW;
    dr=dr*(1-mandoW)+((stats1.homeDrawPct+stats2.awayDrawPct)/2)*mandoW;
  } else if(mando==="t2_casa") {
    t1=t1*(1-mandoW)+stats1.awayPct*mandoW;
    t2=t2*(1-mandoW)+stats2.homePct*mandoW;
    dr=dr*(1-mandoW)+((stats1.awayDrawPct+stats2.homeDrawPct)/2)*mandoW;
  }

  // Clamp: probabilidade nunca pode ser negativa
  t1 = Math.max(t1, 0);
  dr = Math.max(dr, 0);
  t2 = Math.max(t2, 0);

  const soma = Math.max(t1+dr+t2, .001);
  const vit1 = confrontos.filter(p =>
    (p.mandante===time1&&(p.gols_mandante??0)>(p.gols_visitante??0))||
    (p.visitante===time1&&(p.gols_visitante??0)>(p.gols_mandante??0))).length;
  const vit2 = confrontos.filter(p =>
    (p.mandante===time2&&(p.gols_mandante??0)>(p.gols_visitante??0))||
    (p.visitante===time2&&(p.gols_visitante??0)>(p.gols_mandante??0))).length;

  return {
    t1:   +(t1/soma*100).toFixed(1),
    draw: +(dr/soma*100).toFixed(1),
    t2:   +(t2/soma*100).toFixed(1),
    vit1, emps: total-vit1-vit2, vit2, total,
    h2h: { pct1:+(h2h.pct1*100).toFixed(1), pctDraw:+(h2h.pctDraw*100).toFixed(1), pct2:+(h2h.pct2*100).toFixed(1), totalW:+h2h.totalW.toFixed(1) },
  };
}
