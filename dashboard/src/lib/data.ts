// Helpers para carregar os JSON exportados pelo script export_data.py

export type Classificacao = {
  temporada: number; clube: string; pontos: number;
  vitorias: number; empates: number; derrotas: number;
  gols_pro: number; gols_contra: number; jogos: number;
};
export type Partida = {
  partida_id: number; temporada: number; rodada: number;
  data: string; mandante: string; gols_mandante: number | null;
  gols_visitante: number | null; visitante: string;
  arena: string | null; status: string; fonte: string;
};
export type Gol = {
  partida_id: number; clube: string; atleta: string;
  minuto: number; tipo_de_gol: string; temporada: number; rodada: number;
};
export type Cartao = {
  partida_id: number; clube: string; atleta: string;
  minuto: number; cartao: string; temporada: number;
};
export type Artilharia = {
  temporada: number; atleta: string; clube: string; gols: number;
};
export type TemporadaMeta = {
  temporada: number; total_partidas: number;
  total_gols: number; inicio: string; fim: string;
};
export type Campeao = { temporada: number; clube: string; pontos: number };
export type DesempenhoClube = {
  temporada: number; clube: string; jogos: number;
  vitorias: number; empates: number; derrotas: number;
  gols_pro: number; gols_contra: number; pontos: number;
};

const BASE = "/data/json";

async function fetchJson<T>(name: string): Promise<T[]> {
  const res = await fetch(`${BASE}/${name}.json`);
  if (!res.ok) throw new Error(`Falha ao carregar ${name}.json`);
  return res.json();
}

export const getData = {
  classificacao:   () => fetchJson<Classificacao>("classificacao"),
  partidas:        () => fetchJson<Partida>("partidas_resumo"),
  gols:            () => fetchJson<Gol>("gols"),
  cartoes:         () => fetchJson<Cartao>("cartoes"),
  artilharia:      () => fetchJson<Artilharia>("artilharia"),
  fairPlay:        () => fetchJson<any>("fair_play"),
  campeoes:        () => fetchJson<Campeao>("campeoes"),
  temporadasMeta:  () => fetchJson<TemporadaMeta>("temporadas_meta"),
  desempenho:      () => fetchJson<DesempenhoClube>("desempenho_clubes"),
  clubes:          () => fetchJson<{ clube: string }>("clubes"),
  rebaixamento:    () => fetchJson<any>("rebaixamento_acesso"),
};
