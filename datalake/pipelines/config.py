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
RELEGATION_SPOTS = 4        # bottom 4 go to Série B (2003: só 2 — ver zonas_temporada)


def zonas_temporada(temporada: int) -> dict:
    """Zonas de classificação definidas pelo regulamento de cada época.

    Representam as faixas que o Brasileirão garante por posição — NÃO incluem
    as vagas "herdadas" quando um clube já classificado vence a Copa do Brasil,
    a Libertadores ou a Sul-Americana (o G6 virar G7/G8 etc.).

    - 2003–2015: Libertadores para o G4. A Sul-Americana tinha critério
      variável (ranking/convite/Copa do Brasil), então não é rotulada.
    - 2016–2025: G6 Libertadores (1º–4º grupos, 5º–6º pré) e 7º–12º Sul-Americana.
    - 2026+: Copa do Brasil passa a dar 2 vagas → G5 Libertadores
      (1º–4º grupos, 5º pré) e 6º–11º Sul-Americana (regulamento CBF 2026).
    - Rebaixamento: 2 clubes em 2003 (24 times), 4 a partir de 2004.
    """
    rebaixados = 2 if temporada == 2003 else 4
    if temporada <= 2015:
        lib, sula = (1, 4), None
    elif temporada <= 2025:
        lib, sula = (1, 6), (7, 12)
    else:
        lib, sula = (1, 5), (6, 11)
    return {"libertadores": lib, "sula": sula, "rebaixados": rebaixados}


# Punições de pontos aplicadas pela Justiça Desportiva que constam da
# classificação oficial final. A tabela é calculada a partir dos placares,
# então sem estes ajustes a ordem final (e o rebaixamento) sai diferente
# da oficial — ex.: 2013, em que a Portuguesa caiu e o Fluminense ficou.
# (temporada, clube): pontos a somar (negativo = punição)
AJUSTES_PONTOS = {
    (2003, "Paysandu"):        -8,   # escalação irregular (Júnior Amorim e Aldrovani)
    (2004, "Sao Caetano"):     -24,  # morte do jogador Serginho em campo
    (2010, "Gremio Prudente"): -3,   # escalação de jogador suspenso
    (2013, "Flamengo"):        -4,   # escalação irregular de André Santos (rodada 38)
    (2013, "Portuguesa"):      -4,   # escalação irregular de Héverton (rodada 38)
    (2018, "Sport"):           -3,   # atraso de salário (jogador Gabriel)
}

# ── Cache directory for raw API responses ────────────────────────────────────
API_CACHE_DIR = DATALAKE_DIR / "bronze" / "api_cache"
API_CACHE_DIR.mkdir(parents=True, exist_ok=True)
