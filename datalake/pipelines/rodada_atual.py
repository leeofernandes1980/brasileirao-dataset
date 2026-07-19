"""
Detecta a "rodada atual" do campeonato a partir do calendário já conhecido
(datalake/silver/partidas.parquet), para que a Action de atualização possa
buscar só essa rodada na API em vez de varrer o campeonato inteiro (o que
dispara o rate-limit/403 do Sofascore).

Heurística: por causa de jogos adiados/remarcados, a rodada "N" pode ter
partidas espalhadas por semanas diferentes das demais rodadas. Por isso não
basta olhar a rodada da partida mais próxima de hoje — contamos, dentro de
uma janela de +-N dias em torno de hoje, qual número de rodada tem mais
partidas caindo nela, e assumimos que essa é a rodada em disputa esta semana.

Uso:
    python rodada_atual.py --seasons 2026
    python rodada_atual.py --seasons 2026 --janela-dias 4

Imprime só o número da rodada em stdout (ou nada, se não achar candidata).
"""
import argparse
import sys
from datetime import timedelta

import pandas as pd

from config import SILVER_DIR, CURRENT_SEASON


def rodada_atual(season: int, janela_dias: int = 4, hoje: pd.Timestamp | None = None) -> int | None:
    path = SILVER_DIR / "partidas.parquet"
    if not path.exists():
        return None

    df = pd.read_parquet(path)
    df = df[df["temporada"] == season].dropna(subset=["data", "rodada"])
    if df.empty:
        return None

    hoje = hoje or pd.Timestamp.now().normalize()
    janela = df[(df["data"] >= hoje - timedelta(days=janela_dias)) &
                (df["data"] <= hoje + timedelta(days=janela_dias))]

    if janela.empty:
        # Sem partidas perto de hoje (ex.: início/fim de temporada) — usa a
        # rodada da partida com data mais próxima, dentre as ainda não finalizadas.
        pendentes = df[df["gols_mandante"].isna()]
        candidatas = pendentes if not pendentes.empty else df
        idx = (candidatas["data"] - hoje).abs().idxmin()
        return int(candidatas.loc[idx, "rodada"])

    contagem = janela["rodada"].value_counts()
    return int(contagem.idxmax())


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--seasons", type=int, default=CURRENT_SEASON)
    parser.add_argument("--janela-dias", type=int, default=4)
    args = parser.parse_args()

    rd = rodada_atual(args.seasons, args.janela_dias)
    if rd is None:
        log_msg = f"Não foi possível detectar a rodada atual da temporada {args.seasons}."
        print(log_msg, file=sys.stderr)
        sys.exit(1)

    print(rd)
