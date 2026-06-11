"""Testa API publica do Sofascore (api.sofascore.com) — sem RapidAPI."""
import sys
sys.stdout.reconfigure(encoding="utf-8")

import truststore; truststore.inject_into_ssl()
import requests, json, datetime, time

# API publica do Sofascore (usada pelo proprio site)
BASE_PUBLIC = "https://api.sofascore.com/api/v1"
SEASON_2024 = 58766
TOURNAMENT  = 325

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Referer": "https://www.sofascore.com/",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "pt-BR,pt;q=0.9,en;q=0.8",
}

def get_public(path, params=None):
    url = f"{BASE_PUBLIC}/{path}"
    r = requests.get(url, headers=HEADERS, params=params or {}, timeout=15)
    print(f"  GET {url} -> {r.status_code}")
    try: return r.status_code, r.json()
    except: return r.status_code, {}

print("=== Teste: buscar rodada 1 de 2024 ===")
code, data = get_public(f"unique-tournament/{TOURNAMENT}/season/{SEASON_2024}/events/round/1")
print(f"  Keys: {list(data.keys())}")
events = data.get("events", [])
print(f"  Partidas: {len(events)}")
if events:
    for ev in events:
        home = ev.get("homeTeam", {}).get("name","?")
        away = ev.get("awayTeam", {}).get("name","?")
        hs = ev.get("homeScore", {}).get("current","?")
        as_ = ev.get("awayScore", {}).get("current","?")
        rd = ev.get("roundInfo", {}).get("round","?")
        print(f"    [{rd}] {home} {hs} x {as_} {away}")

print()
time.sleep(2)
print("=== Teste: buscar rodada 10 de 2024 ===")
code, data = get_public(f"unique-tournament/{TOURNAMENT}/season/{SEASON_2024}/events/round/10")
events = data.get("events", [])
print(f"  Partidas: {len(events)}")
if events:
    for ev in events:
        home = ev.get("homeTeam", {}).get("name","?")
        away = ev.get("awayTeam", {}).get("name","?")
        hs = ev.get("homeScore", {}).get("current","?")
        as_ = ev.get("awayScore", {}).get("current","?")
        rd = ev.get("roundInfo", {}).get("round","?")
        print(f"    [{rd}] {home} {hs} x {as_} {away}")

print()
time.sleep(2)
print("=== Teste: rodada 1 de 2025 ===")
SEASON_2025 = 72034
code, data = get_public(f"unique-tournament/{TOURNAMENT}/season/{SEASON_2025}/events/round/1")
events = data.get("events", [])
print(f"  Partidas: {len(events)}")
if events:
    for ev in events:
        home = ev.get("homeTeam", {}).get("name","?")
        away = ev.get("awayTeam", {}).get("name","?")
        hs = ev.get("homeScore", {}).get("current","?")
        as_ = ev.get("awayScore", {}).get("current","?")
        print(f"    {home} {hs} x {as_} {away}")
