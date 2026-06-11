"""
Ingests Brasileirão data for 2024, 2025, and 2026 from the API-Football.

For each season it fetches:
  - All fixtures (partidas)
  - Per-fixture: statistics, events (goals + cards), lineups

Results are appended to the existing silver Parquet files.

Free-tier quota: 100 req/day.
  • 1 req  → fixture list per season    (~3 seasons = 3 req)
  • 1 req  → standings per season       (~3 req)
  • 3 req  per match (stats + events + lineups)
  → full 3-season fetch ≈ 3 + 3 + 3×380×3 = ~3.4k requests (needs paid tier)
  → use --fixtures-only to fetch only match results (6 req total, free-tier safe)
"""
import argparse
import logging
import pandas as pd
import pyarrow as pa
import pyarrow.parquet as pq
from pathlib import Path
from tqdm import tqdm
import api_football as af
from config import SILVER_DIR, NEW_SEASONS

logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")
log = logging.getLogger(__name__)

SILVER_DIR.mkdir(parents=True, exist_ok=True)


# ── upsert helpers ────────────────────────────────────────────────────────────

def _load_existing(path: Path) -> pd.DataFrame:
    if path.exists():
        return pd.read_parquet(path)
    return pd.DataFrame()


def _upsert_parquet(path: Path, new_df: pd.DataFrame, key_cols: list[str]) -> None:
    """Append new rows, removing duplicates by key_cols."""
    existing = _load_existing(path)
    combined = pd.concat([existing, new_df], ignore_index=True)
    combined = combined.drop_duplicates(subset=key_cols, keep="last")
    combined.to_parquet(path, index=False, engine="pyarrow")
    log.info("%-30s  total=%d  (novos=%d)", path.name, len(combined), len(new_df))


# ── partidas ──────────────────────────────────────────────────────────────────

def ingest_partidas(seasons: list[int]) -> dict[int, list[dict]]:
    """Fetch fixtures and update silver/partidas.parquet. Returns fixture list per season."""
    all_fixtures: dict[int, list[dict]] = {}

    for season in seasons:
        log.info("Buscando partidas — temporada %d", season)
        raw = af.get_fixtures(season)
        if not raw:
            log.warning("Sem dados para %d", season)
            continue

        rows = [af.parse_fixture(f) for f in raw]
        for r in rows:
            r["temporada"] = season
            r["fonte"]     = "api_football"
            # Rename fixture_id → partida_id for consistency with existing schema
            r["partida_id"] = r.pop("fixture_id")

        all_fixtures[season] = raw   # keep originals for detail fetches
        df = pd.DataFrame(rows)
        _upsert_parquet(SILVER_DIR / "partidas.parquet", df, key_cols=["partida_id"])

    return all_fixtures


# ── standings ─────────────────────────────────────────────────────────────────

def ingest_standings(seasons: list[int]) -> None:
    rows = []
    for season in seasons:
        log.info("Buscando classificação — temporada %d", season)
        raw = af.get_standings(season)
        rows.extend(af.parse_standings(season, raw))

    if not rows:
        return

    df = pd.DataFrame(rows)
    df["fonte"] = "api_football"
    _upsert_parquet(SILVER_DIR / "classificacao.parquet", df, key_cols=["temporada", "clube"])


# ── per-fixture detail (stats, events, lineups) ───────────────────────────────

def ingest_fixture_details(raw_fixtures: dict[int, list[dict]]) -> None:
    """Fetch stats, events, and lineups for each completed fixture."""
    all_stats, all_gols, all_cartoes, all_escalacoes = [], [], [], []

    all_raw = [(season, f) for season, fixtures in raw_fixtures.items() for f in fixtures]
    finished = [
        (season, f) for season, f in all_raw
        if f.get("fixture", {}).get("status", {}).get("short") == "FT"
    ]

    log.info("Buscando detalhes de %d partidas concluídas...", len(finished))

    for season, fixture in tqdm(finished, desc="Detalhes"):
        fid    = fixture["fixture"]["id"]
        parsed = af.parse_fixture(fixture)

        stats   = af.get_fixture_statistics(fid)
        events  = af.get_fixture_events(fid)
        lineups = af.get_fixture_lineups(fid)

        for row in af.parse_statistics(fid, stats):
            row.update({"temporada": season, "rodada": parsed["rodada"],
                        "partida_id": fid, "fonte": "api_football"})
            all_stats.append(row)

        gols, cartoes = af.parse_events(fid, events)
        for row in gols:
            row.update({"temporada": season, "rodada": parsed["rodada"],
                        "partida_id": fid, "fonte": "api_football"})
            all_gols.append(row)
        for row in cartoes:
            row.update({"temporada": season, "rodada": parsed["rodada"],
                        "partida_id": fid, "fonte": "api_football"})
            all_cartoes.append(row)

        for row in af.parse_lineups(fid, lineups):
            row.update({"temporada": season, "rodada": parsed["rodada"],
                        "partida_id": fid, "fonte": "api_football"})
            all_escalacoes.append(row)

    if all_stats:
        _upsert_parquet(SILVER_DIR / "estatisticas.parquet",
                        pd.DataFrame(all_stats), ["partida_id", "clube"])
    if all_gols:
        _upsert_parquet(SILVER_DIR / "gols.parquet",
                        pd.DataFrame(all_gols),  ["partida_id", "atleta", "minuto"])
    if all_cartoes:
        _upsert_parquet(SILVER_DIR / "cartoes.parquet",
                        pd.DataFrame(all_cartoes), ["partida_id", "atleta", "minuto"])
    if all_escalacoes:
        _upsert_parquet(SILVER_DIR / "escalacoes.parquet",
                        pd.DataFrame(all_escalacoes), ["partida_id", "clube", "atleta"])


# ── CLI ───────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description="Ingere dados de 2024-2026 via API-Football")
    parser.add_argument(
        "--seasons", nargs="+", type=int, default=NEW_SEASONS,
        help="Temporadas a buscar (padrão: 2024 2025 2026)",
    )
    parser.add_argument(
        "--fixtures-only", action="store_true",
        help="Busca apenas resultados (seguro para cota gratuita de 100 req/dia)",
    )
    args = parser.parse_args()

    log.info("=== Ingestão 2024-2026 iniciada ===")
    raw_fixtures = ingest_partidas(args.seasons)
    ingest_standings(args.seasons)

    if not args.fixtures_only:
        ingest_fixture_details(raw_fixtures)
    else:
        log.info("--fixtures-only: detalhes por partida ignorados")

    log.info("=== Ingestão 2024-2026 concluída ===")


if __name__ == "__main__":
    main()
