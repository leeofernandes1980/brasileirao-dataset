"""
Detecta quais rodadas ainda precisam de atualização, a partir do calendário
já conhecido (datalake/silver/partidas.parquet), para que a Action busque só
essas rodadas na API em vez de varrer o campeonato inteiro (o que dispara o
rate-limit/403 do Sofascore).

Critério: qualquer partida com status "notstarted" cuja data já passou —
ou seja, que já deveria ter sido jogada mas ainda não temos o resultado.
Isso cobre tanto a rodada em disputa nesta semana quanto qualquer rodada
anterior que ficou pra trás (jogo remarcado, atraso de captura etc.), sem
depender de "qual rodada tem mais jogos perto de hoje". Partidas
"postponed" sem nova data são ignoradas (não são uma pendência acionável
ainda) e partidas "finished" obviamente também.

Uso:
    python rodada_atual.py --seasons 2026

Imprime uma linha:
  - números das rodadas pendentes separados por espaço, ou
  - "todas" se ainda não há dados locais (primeira execução — melhor
    varrer o campeonato inteiro pra popular o calendário), ou
  - nada, se não há nenhuma pendência (dataset em dia).
"""
import argparse

import pandas as pd

from config import SILVER_DIR, CURRENT_SEASON


def rodadas_pendentes(season: int, hoje: pd.Timestamp | None = None) -> list[int] | None:
    path = SILVER_DIR / "partidas.parquet"
    if not path.exists():
        return None

    df = pd.read_parquet(path)
    df = df[df["temporada"] == season].dropna(subset=["data", "rodada"])
    if df.empty:
        return None

    hoje = hoje or pd.Timestamp.now().normalize()
    pendentes = df[(df["status"] == "notstarted") & (df["data"] <= hoje)]
    return sorted(int(r) for r in pendentes["rodada"].unique())


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--seasons", type=int, default=CURRENT_SEASON)
    args = parser.parse_args()

    rodadas = rodadas_pendentes(args.seasons)
    if rodadas is None:
        print("todas")
    elif rodadas:
        print(" ".join(str(r) for r in rodadas))
    # lista vazia: não imprime nada — nenhuma pendência, nada a buscar
