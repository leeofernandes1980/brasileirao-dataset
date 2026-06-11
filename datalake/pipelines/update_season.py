"""
Incremental updater for the current season (2026).

Run this script periodically (weekly or after each round) to pull the latest
results without re-fetching historical data.

Usage:
    python update_season.py                      # updates current season
    python update_season.py --season 2025        # re-syncs a specific season
    python update_season.py --rebuild-gold       # also rebuilds gold tables
"""
import argparse
import logging
import subprocess
import sys
from pathlib import Path
import api_football as af
import pandas as pd
from config import SILVER_DIR, CURRENT_SEASON
import ingest_2024_2026 as ing
import build_gold

logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")
log = logging.getLogger(__name__)


def get_last_synced_round(season: int) -> int:
    """Return the highest round already stored for this season."""
    path = SILVER_DIR / "partidas.parquet"
    if not path.exists():
        return 0
    df = pd.read_parquet(path, columns=["temporada", "rodada", "status"])
    season_df = df[df["temporada"] == season]
    if season_df.empty:
        return 0
    # Consider only finished matches (status = FT)
    finished = season_df[season_df.get("status", pd.Series(dtype=str)) == "FT"]
    if finished.empty:
        return 0
    return int(finished["rodada"].max())


def update_season(season: int, fixtures_only: bool = False) -> None:
    log.info("Atualizando temporada %d...", season)

    last_round = get_last_synced_round(season)
    log.info("Última rodada sincronizada: %d", last_round)

    raw = af.get_fixtures(season)
    if not raw:
        log.warning("Sem fixtures retornados pela API para %d", season)
        return

    # Filter to new or changed fixtures only
    new_raw = [
        f for f in raw
        if _round_of(f) is None or _round_of(f) > last_round
        or f.get("fixture", {}).get("status", {}).get("short") != "FT"
    ]

    if not new_raw:
        log.info("Nenhuma partida nova — temporada %d já sincronizada", season)
        return

    log.info("%d partidas novas/atualizadas encontradas", len(new_raw))

    rows = [af.parse_fixture(f) for f in new_raw]
    for r in rows:
        r["temporada"] = season
        r["fonte"]     = "api_football"
        r["partida_id"] = r.pop("fixture_id")

    ing._upsert_parquet(SILVER_DIR / "partidas.parquet", pd.DataFrame(rows), ["partida_id"])

    # Update standings
    standings_raw = af.get_standings(season)
    if standings_raw:
        df_st = pd.DataFrame(af.parse_standings(season, standings_raw))
        df_st["fonte"] = "api_football"
        ing._upsert_parquet(SILVER_DIR / "classificacao.parquet", df_st, ["temporada", "clube"])

    if not fixtures_only:
        ing.ingest_fixture_details({season: new_raw})

    log.info("Temporada %d atualizada", season)


def _round_of(fixture: dict) -> int | None:
    round_str = fixture.get("league", {}).get("round", "")
    if " - " in round_str:
        try:
            return int(round_str.split(" - ")[-1])
        except ValueError:
            pass
    return None


def main() -> None:
    parser = argparse.ArgumentParser(description="Atualização incremental do Brasileirão")
    parser.add_argument("--season", type=int, default=CURRENT_SEASON)
    parser.add_argument("--fixtures-only", action="store_true")
    parser.add_argument("--rebuild-gold", action="store_true",
                        help="Reconstruir tabelas Gold após sincronização")
    args = parser.parse_args()

    update_season(args.season, fixtures_only=args.fixtures_only)

    if args.rebuild_gold:
        log.info("Reconstruindo camada Gold...")
        build_gold.main()

    log.info("Atualização concluída.")


if __name__ == "__main__":
    main()
