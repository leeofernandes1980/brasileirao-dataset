"""
Backfill histórico de gols e cartões para temporadas 2003-2013 via Sofascore.

Busca apenas incidents (gols/cartões) — NÃO atualiza partidas.parquet
para evitar duplicação com os dados CSV históricos.

Os gols/cartões usam o event_id do Sofascore como partida_id, igual ao
comportamento do ingest_sofascore.py, garantindo deduplicação correta no upsert.

Uso:
    python ingest_historico_gols.py                      # 2003-2013
    python ingest_historico_gols.py --seasons 2010 2011  # temporadas específicas
    python ingest_historico_gols.py --seasons 2013       # teste com 1 temporada
"""
import argparse, logging
import pandas as pd
from pathlib import Path
from tqdm import tqdm
import api_sofascore as sf
from config import SILVER_DIR

logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")
log = logging.getLogger(__name__)

DEFAULT_SEASONS = list(range(2003, 2014))  # 2003 a 2013


def _upsert(path: Path, new_df: pd.DataFrame, keys: list[str]) -> None:
    if path.exists():
        existing = pd.read_parquet(path)
        combined = pd.concat([existing, new_df], ignore_index=True)
    else:
        combined = new_df
    combined = combined.drop_duplicates(subset=keys, keep="last")
    combined.to_parquet(path, index=False, engine="pyarrow")
    log.info("  %-30s  total=%d  (novos=%d)", path.name, len(combined), len(new_df))


def ingest_season(season: int) -> tuple[list, list]:
    if season not in sf.SEASON_IDS:
        log.error("Temporada %d sem season_id em SEASON_IDS", season)
        return [], []

    rounds = sf.get_rounds(season)
    log.info("Temporada %d — %d rodadas", season, len(rounds))

    gol_rows, cartao_rows = [], []

    for rd in tqdm(rounds, desc=f"{season} rodadas"):
        events = sf.get_matches(season, rd)
        for ev in events:
            status = ev.get("status", {}).get("type", "")
            if status != "finished":
                continue

            mid  = ev["id"]
            home = sf._norm(ev.get("homeTeam", {}).get("name", "")) or ""
            away = sf._norm(ev.get("awayTeam", {}).get("name", "")) or ""

            incidents = sf.get_incidents(mid)
            gols, cartoes = sf.parse_incidents(mid, incidents, home, away)

            for g in gols:
                g.update({"temporada": season, "rodada": rd})
            for c in cartoes:
                c.update({"temporada": season, "rodada": rd})

            gol_rows.extend(gols)
            cartao_rows.extend(cartoes)

    log.info("  Temporada %d: %d gols, %d cartões coletados",
             season, len(gol_rows), len(cartao_rows))
    return gol_rows, cartao_rows


def main() -> None:
    parser = argparse.ArgumentParser(description="Backfill gols/cartões históricos via Sofascore")
    parser.add_argument("--seasons", nargs="+", type=int, default=DEFAULT_SEASONS)
    args = parser.parse_args()

    log.info("=== Backfill histórico de gols: %s ===", args.seasons)

    all_gols, all_cartoes = [], []
    for season in args.seasons:
        g, c = ingest_season(season)
        all_gols.extend(g)
        all_cartoes.extend(c)

    if all_gols:
        df_gols = pd.DataFrame(all_gols)
        df_gols["partida_id"] = pd.to_numeric(df_gols["partida_id"], errors="coerce").astype("Int64")
        df_gols["minuto"]     = pd.to_numeric(df_gols["minuto"],     errors="coerce").astype("Int64")
        _upsert(SILVER_DIR / "gols.parquet", df_gols,
                keys=["partida_id", "atleta", "minuto"])

    if all_cartoes:
        df_cartoes = pd.DataFrame(all_cartoes)
        df_cartoes["partida_id"] = pd.to_numeric(df_cartoes["partida_id"], errors="coerce").astype("Int64")
        df_cartoes["minuto"]     = pd.to_numeric(df_cartoes["minuto"],     errors="coerce").astype("Int64")
        _upsert(SILVER_DIR / "cartoes.parquet", df_cartoes,
                keys=["partida_id", "atleta", "minuto"])

    log.info("=== Backfill concluído: %d gols, %d cartões ===",
             len(all_gols), len(all_cartoes))


if __name__ == "__main__":
    main()
