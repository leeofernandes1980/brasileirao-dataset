"""
Cliente Sofascore para ingestão do Brasileirão Série A.

Endpoints:
  API publica (api.sofascore.com) — sem autenticacao, sem cota:
    /unique-tournament/{t}/season/{s}/events/round/{r}   → partidas por rodada
    /event/{id}/statistics                                → estatísticas
    /event/{id}/lineups                                   → escalações
    /event/{id}/incidents                                 → gols/cartões

  RapidAPI (sofascore.p.rapidapi.com) — usado como fallback:
    /tournaments/get-rounds                               → lista de rodadas
"""
import json, time, logging, os
import truststore; truststore.inject_into_ssl()
import requests
from pathlib import Path
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env")

log = logging.getLogger(__name__)

# ── RapidAPI (rounds, statistics fallback) ─────────────────────────────────
_KEY  = os.getenv("API_FOOTBALL_KEY", "")
_HOST = "sofascore.p.rapidapi.com"
_BASE = "https://sofascore.p.rapidapi.com"
_HDR  = {"x-rapidapi-key": _KEY, "x-rapidapi-host": _HOST}

# ── API pública Sofascore ──────────────────────────────────────────────────
_BASE_PUBLIC = "https://api.sofascore.com/api/v1"
_HDR_PUBLIC  = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Referer": "https://www.sofascore.com/",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
}

TOURNAMENT_ID = 325      # Brasileirão Série A

# Mapa temporada → season_id do Sofascore
SEASON_IDS = {
    2003: 90151, 2004: 90149, 2005: 10050, 2006: 90145, 2007: 89936,
    2008:  1223, 2009:  2079, 2010:  2684, 2011:  3311, 2012:  4438,
    2013:  6075, 2014:  7778,
    2015: 10173, 2016: 11429, 2017: 13100, 2018: 16183,
    2019: 22931, 2020: 27591, 2021: 36166, 2022: 40557,
    2023: 48982, 2024: 58766, 2025: 72034, 2026: 87678,
}

_INTERVAL_RAPID  = 7.0   # seg entre chamadas RapidAPI (free ≈ 10 req/min)
_INTERVAL_PUBLIC = 1.5   # seg entre chamadas API pública

_CACHE_DIR = Path(__file__).parent.parent / "bronze" / "api_cache"
_CACHE_DIR.mkdir(parents=True, exist_ok=True)


# ── helpers de cache ──────────────────────────────────────────────────────

def _cache_path(prefix: str, slug: str, **params) -> Path:
    pstr = "_".join(f"{k}{v}" for k, v in sorted(params.items()))
    return _CACHE_DIR / f"{prefix}__{slug}__{pstr}.json"


def _get(path: str, **params) -> dict:
    """Chama RapidAPI Sofascore com cache."""
    if not _KEY:
        raise RuntimeError("RAPIDAPI_KEY nao definida no .env (variavel API_FOOTBALL_KEY)")
    slug = path.strip("/").replace("/", "_")
    cache = _cache_path("sfs", slug, **params)
    if cache.exists():
        log.debug("cache hit: %s", cache.name)
        return json.loads(cache.read_text(encoding="utf-8"))

    url = f"{_BASE}/{path.lstrip('/')}"
    log.info("RapidAPI GET %-40s  params=%s", path, params)
    time.sleep(_INTERVAL_RAPID)

    r = requests.get(url, headers=_HDR, params=params, timeout=30)
    r.raise_for_status()
    data = r.json()
    cache.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    return data


def _get_public(path: str) -> dict:
    """Chama api.sofascore.com (API pública) com cache. Retorna {} em 404."""
    slug = path.strip("/").replace("/", "_").replace("{", "").replace("}", "")
    cache = _cache_path("pub", slug)
    if cache.exists():
        log.debug("cache hit (pub): %s", cache.name)
        return json.loads(cache.read_text(encoding="utf-8"))

    url = f"{_BASE_PUBLIC}/{path.lstrip('/')}"
    log.info("Public GET %s", url)
    time.sleep(_INTERVAL_PUBLIC)

    r = requests.get(url, headers=_HDR_PUBLIC, timeout=30)

    if r.status_code == 404:
        log.debug("404 (sem dados): %s", path)
        return {}

    if r.status_code in (429, 403):
        wait = 30 if r.status_code == 429 else 15
        log.warning("%d em %s — aguardando %ds e tentando novamente...", r.status_code, path, wait)
        time.sleep(wait)
        r = requests.get(url, headers=_HDR_PUBLIC, timeout=30)
        if r.status_code in (403, 404, 429):
            log.warning("%d persistente — ignorando %s (rodada indisponível ou bloqueada)", r.status_code, path)
            return {}

    r.raise_for_status()
    data = r.json()
    cache.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    return data


# ── API pública ───────────────────────────────────────────────────────────────

def get_rounds(season: int) -> list[int]:
    """Retorna rodadas disponíveis via API pública — sem custo, sem chave."""
    sid = SEASON_IDS[season]
    data = _get_public(f"unique-tournament/{TOURNAMENT_ID}/season/{sid}/rounds")
    rounds = data.get("rounds", [])
    if rounds:
        return [r["round"] for r in rounds]
    # fallback: Brasileirao sempre tem 38 rodadas
    return list(range(1, 39))


def get_matches(season: int, round_: int) -> list[dict]:
    """Retorna partidas de uma rodada via API publica (10 partidas por rodada)."""
    sid = SEASON_IDS[season]
    path = f"unique-tournament/{TOURNAMENT_ID}/season/{sid}/events/round/{round_}"
    data = _get_public(path)
    return data.get("events", [])


def get_statistics(match_id: int) -> list[dict]:
    data = _get_public(f"event/{match_id}/statistics")
    return data.get("statistics", [])


def get_lineups(match_id: int) -> dict:
    return _get_public(f"event/{match_id}/lineups")


def get_incidents(match_id: int) -> list[dict]:
    data = _get_public(f"event/{match_id}/incidents")
    return data.get("incidents", [])


# ── normalização de nomes ─────────────────────────────────────────────────────
# Sofascore usa nomes completos/acentuados; padroniza para os nomes do CSV histórico.
_TEAM_NAMES: dict[str, str] = {
    "Athletico":            "Athletico-PR",
    "Atlético Paranaense":  "Athletico-PR",
    "Atlético Goianiense":  "Atletico-GO",
    "Atlético Mineiro":     "Atletico-MG",
    "Botafogo":             "Botafogo-RJ",
    "Ceará":                "Ceara",
    "Criciúma":             "Criciuma",
    "Cuiabá":               "Cuiaba",
    "Grêmio":               "Gremio",
    "Goiás":                "Goias",
    "Red Bull Bragantino":  "Bragantino",
    "São Paulo":            "Sao Paulo",
    "Sport Recife":         "Sport",
    "Vasco da Gama":        "Vasco",
    "Vitória":              "Vitoria",
    "América Mineiro":      "America-MG",
    "América-MG":           "America-MG",
    "Avaí":                 "Avai",
    "Náutico":              "Nautico",
    "Paraná":               "Parana",
    "Ponte Preta":          "Ponte Preta",
}

def _norm(name: str | None) -> str | None:
    if name is None:
        return None
    return _TEAM_NAMES.get(name, name)


# ── parsers ───────────────────────────────────────────────────────────────────

def parse_match(ev: dict, season: int, round_: int) -> dict:
    home  = ev.get("homeTeam", {})
    away  = ev.get("awayTeam", {})
    hs    = ev.get("homeScore", {})
    as_   = ev.get("awayScore", {})
    venue = ev.get("venue", {})
    ts    = ev.get("startTimestamp")
    status = ev.get("status", {}).get("type", "")

    import datetime
    if ts:
        dt = datetime.datetime.utcfromtimestamp(ts)
        data_str = dt.strftime("%Y-%m-%d")
        hora_str = dt.strftime("%H:%M")
    else:
        data_str = hora_str = None

    gh = hs.get("current")
    ga = as_.get("current")
    home_name = _norm(home.get("name"))
    away_name = _norm(away.get("name"))

    winner = None
    if gh is not None and ga is not None and status == "finished":
        if gh > ga:
            winner = home_name
        elif ga > gh:
            winner = away_name
        else:
            winner = "-"

    return {
        "partida_id":    ev.get("id"),
        "temporada":     season,
        "rodada":        round_,
        "data":          data_str,
        "hora":          hora_str,
        "mandante":      home_name,
        "visitante":     away_name,
        "mandante_id":   home.get("id"),
        "visitante_id":  away.get("id"),
        "gols_mandante": gh,
        "gols_visitante":ga,
        "vencedor":      winner,
        "arena":         venue.get("stadium", {}).get("name") or venue.get("name"),
        "status":        status,
        "fonte":         "sofascore",
    }


def parse_statistics(match_id: int, stats: list[dict]) -> list[dict]:
    rows = []
    for period_block in stats:
        if period_block.get("period") != "ALL":
            continue
        for group in period_block.get("groups", []):
            for item in group.get("statisticsItems", []):
                key = item.get("key")
                rows.append({
                    "match_id":  match_id,
                    "stat_key":  key,
                    "stat_name": item.get("name"),
                    "home":      item.get("homeValue"),
                    "away":      item.get("awayValue"),
                })

    # Pivotar para o schema silver (mandante/visitante)
    stat_map_h = {r["stat_key"]: r["home"] for r in rows}
    stat_map_a = {r["stat_key"]: r["away"] for r in rows}

    def team_row(team: str, smap: dict) -> dict:
        def pct(v):
            if v is None: return None
            try: return float(str(v).replace("%", ""))
            except: return None
        return {
            "partida_id":      match_id,
            "clube":           team,
            "chutes":          smap.get("totalShotsOnGoal"),
            "chutes_no_alvo":  smap.get("shotsOnTarget"),
            "posse_de_bola":   pct(smap.get("ballPossession")),
            "passes":          smap.get("totalPasses"),
            "precisao_passes": pct(smap.get("accuratePassesPercentage")),
            "faltas":          smap.get("fouls"),
            "cartao_amarelo":  smap.get("yellowCards"),
            "cartao_vermelho": smap.get("redCards"),
            "impedimentos":    smap.get("offsides"),
            "escanteios":      smap.get("cornerKicks"),
            "fonte":           "sofascore",
        }

    return [team_row("mandante", stat_map_h), team_row("visitante", stat_map_a)]


def parse_incidents(match_id: int, incidents: list[dict], home_name: str, away_name: str) -> tuple[list, list]:
    gols, cartoes = [], []
    for inc in incidents:
        itype = inc.get("incidentType", "")
        player = inc.get("player", {})
        nome = player.get("name") if player else inc.get("playerName")
        minuto = inc.get("time")
        is_home = inc.get("isHome", True)
        clube = home_name if is_home else away_name

        if itype == "goal":
            tipo = inc.get("incidentClass", "regular")
            tipo_map = {"regular": "Normal", "penalty": "Pênalti",
                        "ownGoal": "Gol Contra", "fromCorner": "De Escanteio"}
            gols.append({
                "partida_id":  match_id,
                "clube":       clube,
                "atleta":      nome,
                "minuto":      minuto,
                "tipo_de_gol": tipo_map.get(tipo, tipo),
                "fonte":       "sofascore",
            })
        elif itype == "card":
            card_class = inc.get("incidentClass", "")
            cor = "Vermelho" if "red" in card_class.lower() else "Amarelo"
            cartoes.append({
                "partida_id": match_id,
                "clube":      clube,
                "atleta":     nome,
                "minuto":     minuto,
                "cartao":     cor,
                "posicao":    player.get("position") if player else None,
                "num_camisa": player.get("jerseyNumber") if player else None,
                "fonte":      "sofascore",
            })
    return gols, cartoes


def parse_lineups(match_id: int, data: dict, home_name: str, away_name: str) -> list[dict]:
    rows = []
    for side, clube in [("home", home_name), ("away", away_name)]:
        team_data = data.get(side, {})
        formation = team_data.get("formation")
        for player in team_data.get("players", []):
            p = player.get("player", {})
            stats = player.get("statistics", {})
            rows.append({
                "partida_id": match_id,
                "clube":      clube,
                "formacao":   formation,
                "atleta":     p.get("name"),
                "num_camisa": p.get("jerseyNumber"),
                "posicao":    p.get("position"),
                "titular":    player.get("substitute") is False,
                "fonte":      "sofascore",
            })
    return rows
