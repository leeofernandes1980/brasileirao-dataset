"""Central configuration for the Brasileirao Data Lake."""
from pathlib import Path
import os
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env")

# ── Directory layout ────────────────────────────────────────────────────────
DATALAKE_DIR = Path(__file__).parent.parent
SOURCE_DIR   = DATALAKE_DIR.parent          # Brasileirao_Dataset-master root

BRONZE_DIR  = DATALAKE_DIR / "bronze"
SILVER_DIR  = DATALAKE_DIR / "silver"
GOLD_DIR    = DATALAKE_DIR / "gold"
CATALOG_DIR = DATALAKE_DIR / "catalog"

# ── Source CSV files (existing dataset) ─────────────────────────────────────
SOURCE_CSVS = {
    "partidas":     SOURCE_DIR / "campeonato-brasileiro-full.csv",
    "estatisticas": SOURCE_DIR / "campeonato-brasileiro-estatisticas-full.csv",
    "gols":         SOURCE_DIR / "campeonato-brasileiro-gols.csv",
    "cartoes":      SOURCE_DIR / "campeonato-brasileiro-cartoes.csv",
}

# Source JSON directory
SOURCE_JSON_DIR = SOURCE_DIR / "data"

# ── API-Football (RapidAPI) ──────────────────────────────────────────────────
API_FOOTBALL_KEY      = os.getenv("API_FOOTBALL_KEY", "")
API_FOOTBALL_HOST     = "api-football-v1.p.rapidapi.com"
API_FOOTBALL_BASE_URL = "https://api-football-v1.p.rapidapi.com/v3"
BRASILEIRAO_LEAGUE_ID = 71          # Brasileirão Série A

# ── Season ranges ────────────────────────────────────────────────────────────
HISTORICAL_SEASONS = list(range(2003, 2024))   # 2003–2023 – existing CSVs
NEW_SEASONS        = [2024, 2025, 2026]
ALL_SEASONS        = HISTORICAL_SEASONS + NEW_SEASONS
CURRENT_SEASON     = 2026

# ── Brasileirão classification rules (top league = 20 teams since 2006) ─────
TEAMS_PER_SEASON = {
    2003: 24, 2004: 24, 2005: 22,
    **{y: 20 for y in range(2006, 2027)},
}
RELEGATION_SPOTS = 4        # bottom 4 go to Série B
LIBERTADORES_SPOTS = 4      # top 4 qualify for Libertadores
SULAMERICANA_SPOTS = 6      # top 6 qualify for Sul-Americana

# ── Cache directory for raw API responses ────────────────────────────────────
API_CACHE_DIR = DATALAKE_DIR / "bronze" / "api_cache"
API_CACHE_DIR.mkdir(parents=True, exist_ok=True)
