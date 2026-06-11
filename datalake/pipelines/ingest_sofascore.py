"""
Ingere Brasileirão 2024-2026 via API Sofascore (RapidAPI).

Uso:
    python ingest_sofascore.py --seasons 2024          # 1 temporada
    python ingest_sofascore.py --seasons 2024 2025 2026
    python ingest_sofascore.py --fixtures-only         # só resultados (economiza cota)
    python ingest_sofascore.py --seasons 2026 --round 5  # rodada específica

Cota free tier: 100 req/dia
  • fixtures-only: 1 (rounds) + 38 (partidas) = 39 req por temporada
  • completo:      39 + 3 × 380 partidas       = ~1.179 req por temporada
"""
import argparse, logging
import pandas as pd
from pathlib import Path
from tqdm import tqdm
import api_sofascore as sf
from config import SILVER_DIR, NEW_SEASONS

logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")
log = logging.getLogger(__name__)
SILVER_DIR.mkdir(parents=True, exist_ok=True)


# ── upsert helper ─────────────────────────────────────────────────────────────

def _upsert(path: Path, new_df: pd.DataFrame, keys: list[str]) -> None:
    if path.exists():
        existing = pd.read_parquet(path)
        combined = pd.concat([existing, new_df], ignore_index=True)
    else:
        combined = new_df
    combined = combined.drop_duplicates(subset=keys, keep="last")
    combined.to_parquet(path, index=False, engine="pyarrow")
    log.info("  %-30s  total=%d  (novos=%d)", path.name, len(combined), len(new_df))


# ── ingestão de partidas (results) ───────────────────────────────────────────

def ingest_season_fixtures(season: int, only_round: int | None = None) -> list[dict]:
    """Busca todas as rodadas e retorna lista de eventos brutos completos."""
    if season not in sf.SEASON_IDS:
        log.error("Temporada %d sem season_id mapeado no Sofascore", season)
        return []

    rounds = sf.get_rounds(season)
    if only_round:
        rounds = [r for r in rounds if r == only_round]

    all_events = []
    match_rows  = []

    log.info("Temporada %d — %d rodadas a processar", season, len(rounds))
    for rd in tqdm(rounds, desc=f"{season} fixtures"):
        events = sf.get_matches(season, rd)
        for ev in events:
            row = sf.parse_match(ev, season, rd)
            match_rows.append(row)
            all_events.append((ev, season, rd))

    if match_rows:
        df = pd.DataFrame(match_rows)
        df["data"] = pd.to_datetime(df["data"], errors="coerce")
        df["partida_id"]    = pd.to_numeric(df["partida_id"],    errors="coerce").astype("Int64")
        df["gols_mandante"] = pd.to_numeric(df["gols_mandante"], errors="coerce").astype("Int64")
        df["gols_visitante"]= pd.to_numeric(df["gols_visitante"],errors="coerce").astype("Int64")
        _upsert(SILVER_DIR / "partidas.parquet", df, keys=["partida_id"])

    return all_events


# ── detalhe por partida ───────────────────────────────────────────────────────

def ingest_match_details(all_events: list[tuple]) -> None:
    stats_rows, gol_rows, cartao_rows, lineup_rows = [], [], [], []

    finished = [
        (ev, s, rd) for ev, s, rd in all_events
        if ev.get("status", {}).get("type") == "finished"
    ]
    log.info("Buscando detalhes de %d partidas concluídas...", len(finished))

    for ev, season, rd in tqdm(finished, desc="Detalhes"):
        mid  = ev["id"]
        home = sf._norm(ev.get("homeTeam", {}).get("name", ""))
        away = sf._norm(ev.get("awayTeam", {}).get("name", ""))

        # estatísticas
        raw_stats = sf.get_statistics(mid)
        for row in sf.parse_statistics(mid, raw_stats):
            row.update({"temporada": season, "rodada": rd})
            stats_rows.append(row)

        # gols + cartões
        incidents = sf.get_incidents(mid)
        gols, cartoes = sf.parse_incidents(mid, incidents, home, away)
        for g in gols:
            g.update({"temporada": season, "rodada": rd})
        for c in cartoes:
            c.update({"temporada": season, "rodada": rd})
        gol_rows.extend(gols)
        cartao_rows.extend(cartoes)

        # escalações
        lineups = sf.get_lineups(mid)
        for row in sf.parse_lineups(mid, lineups, home, away):
            row.update({"temporada": season, "rodada": rd})
            lineup_rows.append(row)

    if stats_rows:
        _upsert(SILVER_DIR / "estatisticas.parquet",
                pd.DataFrame(stats_rows), ["partida_id", "clube"])
    if gol_rows:
        _upsert(SILVER_DIR / "gols.parquet",
                pd.DataFrame(gol_rows), ["partida_id", "atleta", "minuto"])
    if cartao_rows:
        _upsert(SILVER_DIR / "cartoes.parquet",
                pd.DataFrame(cartao_rows), ["partida_id", "atleta", "minuto"])
    if lineup_rows:
        _upsert(SILVER_DIR / "escalacoes.parquet",
                pd.DataFrame(lineup_rows), ["partida_id", "clube", "atleta"])


# ── CLI ───────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--seasons", nargs="+", type=int, default=NEW_SEASONS)
    parser.add_argument("--round", type=int, default=None,
                        help="Buscar apenas esta rodada")
    parser.add_argument("--fixtures-only", action="store_true",
                        help="Apenas resultados — economiza cota (39 req/temporada)")
    args = parser.parse_args()

    log.info("=== Ingestão Sofascore iniciada ===")

    for season in args.seasons:
        events = ingest_season_fixtures(season, only_round=args.round)
        if not args.fixtures_only:
            ingest_match_details(events)

    log.info("=== Ingestão Sofascore concluída ===")


if __name__ == "__main__":
    main()
