"""
API-Football (RapidAPI) client with caching and rate-limit awareness.

Free tier: 100 requests/day.
Cache stores raw JSON responses in bronze/api_cache/ so reruns don't cost quota.
"""
import json
import time
import logging
import truststore
import requests
from pathlib import Path
from datetime import date

truststore.inject_into_ssl()   # usa certificados nativos do Windows
from config import (
    API_FOOTBALL_KEY, API_FOOTBALL_HOST, API_FOOTBALL_BASE_URL,
    BRASILEIRAO_LEAGUE_ID, API_CACHE_DIR,
)

log = logging.getLogger(__name__)

_HEADERS = {
    "x-rapidapi-key":  API_FOOTBALL_KEY,
    "x-rapidapi-host": API_FOOTBALL_HOST,
}

# Seconds between requests — free tier is 10 req/min
_REQUEST_INTERVAL = 6.5


def _cache_path(endpoint: str, **params) -> Path:
    slug = endpoint.strip("/").replace("/", "_")
    param_str = "_".join(f"{k}{v}" for k, v in sorted(params.items()))
    return API_CACHE_DIR / f"{slug}__{param_str}.json"


def _get(endpoint: str, **params) -> dict:
    """GET with file cache. Returns parsed JSON response dict."""
    if not API_FOOTBALL_KEY:
        raise RuntimeError(
            "API_FOOTBALL_KEY não definida. Adicione ao arquivo .env:\n"
            "  API_FOOTBALL_KEY=sua_chave_aqui"
        )

    cache = _cache_path(endpoint, **params)
    if cache.exists():
        log.debug("Cache hit: %s", cache.name)
        return json.loads(cache.read_text(encoding="utf-8"))

    url = f"{API_FOOTBALL_BASE_URL}/{endpoint.lstrip('/')}"
    log.info("API GET %s  params=%s", endpoint, params)
    time.sleep(_REQUEST_INTERVAL)

    resp = requests.get(url, headers=_HEADERS, params=params, timeout=30)
    resp.raise_for_status()

    data = resp.json()
    cache.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    return data


# ── public API ───────────────────────────────────────────────────────────────

def get_fixtures(season: int) -> list[dict]:
    """Return all fixtures for the given Brasileirão season."""
    data = _get("fixtures", league=BRASILEIRAO_LEAGUE_ID, season=season)
    return data.get("response", [])


def get_fixture_statistics(fixture_id: int) -> list[dict]:
    """Return statistics for a single fixture (2 items: home + away)."""
    data = _get("fixtures/statistics", fixture=fixture_id)
    return data.get("response", [])


def get_fixture_events(fixture_id: int) -> list[dict]:
    """Return all events (goals, cards, substitutions) for a fixture."""
    data = _get("fixtures/events", fixture=fixture_id)
    return data.get("response", [])


def get_fixture_lineups(fixture_id: int) -> list[dict]:
    """Return starting XI and subs for both teams."""
    data = _get("fixtures/lineups", fixture=fixture_id)
    return data.get("response", [])


def get_standings(season: int) -> list[dict]:
    """Return league standings for the given season."""
    data = _get("standings", league=BRASILEIRAO_LEAGUE_ID, season=season)
    try:
        return data["response"][0]["league"]["standings"][0]
    except (IndexError, KeyError):
        return []


# ── helpers to parse API responses into flat dicts ───────────────────────────

def parse_fixture(f: dict) -> dict:
    fix    = f.get("fixture", {})
    league = f.get("league", {})
    teams  = f.get("teams",  {})
    goals  = f.get("goals",  {})
    score  = f.get("score",  {})

    round_str = league.get("round", "")          # "Regular Season - 3"
    rodada = None
    if " - " in round_str:
        try:
            rodada = int(round_str.split(" - ")[-1])
        except ValueError:
            pass

    return {
        "fixture_id":       fix.get("id"),
        "rodada":           rodada,
        "data":             fix.get("date", "")[:10],   # YYYY-MM-DD
        "hora":             fix.get("date", "")[11:16],  # HH:MM
        "status":           fix.get("status", {}).get("short"),
        "arena":            fix.get("venue", {}).get("name"),
        "mandante":         teams.get("home", {}).get("name"),
        "visitante":        teams.get("away", {}).get("name"),
        "mandante_id":      teams.get("home", {}).get("id"),
        "visitante_id":     teams.get("away", {}).get("id"),
        "gols_mandante":    goals.get("home"),
        "gols_visitante":   goals.get("away"),
    }


def parse_statistics(fixture_id: int, stats_list: list[dict]) -> list[dict]:
    rows = []
    for team_stats in stats_list:
        team_name = team_stats.get("team", {}).get("name")
        stat_map  = {s["type"]: s["value"] for s in team_stats.get("statistics", [])}
        rows.append({
            "fixture_id":      fixture_id,
            "clube":           team_name,
            "chutes":          stat_map.get("Total Shots"),
            "chutes_no_alvo":  stat_map.get("Shots on Goal"),
            "posse_de_bola":   stat_map.get("Ball Possession"),
            "passes":          stat_map.get("Total passes"),
            "precisao_passes": stat_map.get("Passes %"),
            "faltas":          stat_map.get("Fouls"),
            "cartao_amarelo":  stat_map.get("Yellow Cards"),
            "cartao_vermelho": stat_map.get("Red Cards"),
            "impedimentos":    stat_map.get("Offsides"),
            "escanteios":      stat_map.get("Corner Kicks"),
        })
    return rows


def parse_events(fixture_id: int, events: list[dict]) -> tuple[list[dict], list[dict]]:
    """Split events into (gols, cartoes)."""
    gols, cartoes = [], []
    for ev in events:
        team   = ev.get("team",   {}).get("name")
        player = ev.get("player", {}).get("name")
        minute = ev.get("time",   {}).get("elapsed")
        etype  = ev.get("type",   "")
        detail = ev.get("detail", "")

        if etype == "Goal" and detail != "Missed Penalty":
            tipo = "Normal" if detail == "Normal Goal" else detail
            gols.append({
                "fixture_id":  fixture_id,
                "clube":       team,
                "atleta":      player,
                "minuto":      minute,
                "tipo_de_gol": tipo,
            })
        elif etype == "Card":
            cartoes.append({
                "fixture_id": fixture_id,
                "clube":      team,
                "atleta":     player,
                "minuto":     minute,
                "cartao":     "Amarelo" if "Yellow" in detail else "Vermelho",
                "num_camisa": ev.get("player", {}).get("id"),   # API doesn't return jersey number here
                "posicao":    None,
            })
    return gols, cartoes


def parse_lineups(fixture_id: int, lineups: list[dict]) -> list[dict]:
    rows = []
    for team_lineup in lineups:
        team      = team_lineup.get("team", {}).get("name")
        coach     = team_lineup.get("coach", {}).get("name")
        formation = team_lineup.get("formation")

        for player in team_lineup.get("startXI", []):
            p = player.get("player", {})
            rows.append({
                "fixture_id": fixture_id,
                "clube":      team,
                "tecnico":    coach,
                "formacao":   formation,
                "atleta":     p.get("name"),
                "num_camisa": p.get("number"),
                "posicao":    p.get("pos"),
                "titular":    True,
            })
        for player in team_lineup.get("substitutes", []):
            p = player.get("player", {})
            rows.append({
                "fixture_id": fixture_id,
                "clube":      team,
                "tecnico":    coach,
                "formacao":   formation,
                "atleta":     p.get("name"),
                "num_camisa": p.get("number"),
                "posicao":    p.get("pos"),
                "titular":    False,
            })
    return rows


def parse_standings(season: int, standings: list[dict]) -> list[dict]:
    rows = []
    for entry in standings:
        all_g  = entry.get("all", {})
        goals  = all_g.get("goals", {})
        rows.append({
            "temporada":     season,
            "posicao":       entry.get("rank"),
            "clube":         entry.get("team", {}).get("name"),
            "pontos":        entry.get("points"),
            "jogos":         all_g.get("played"),
            "vitorias":      all_g.get("win"),
            "empates":       all_g.get("draw"),
            "derrotas":      all_g.get("lose"),
            "gols_pro":      goals.get("for"),
            "gols_contra":   goals.get("against"),
            "saldo_gols":    entry.get("goalsDiff"),
            "forma":         entry.get("form"),
        })
    return rows
