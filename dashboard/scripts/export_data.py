"""
Exporta tabelas do datalake para public/data/ do dashboard.

Execute sempre que atualizar os dados do datalake:
    python scripts/export_data.py
"""
import sys, json, shutil
sys.stdout.reconfigure(encoding="utf-8")
from pathlib import Path
import duckdb, pandas as pd

ROOT      = Path(__file__).parent.parent.parent / "datalake"
SILVER    = ROOT / "silver"
GOLD      = ROOT / "gold"
OUT_JSON  = Path(__file__).parent.parent / "public" / "data" / "json"
OUT_PARQ  = Path(__file__).parent.parent / "public" / "data" / "parquet"

OUT_JSON.mkdir(parents=True, exist_ok=True)
OUT_PARQ.mkdir(parents=True, exist_ok=True)

con = duckdb.connect()

def parquet(name: str, layer="gold") -> str:
    base = GOLD if layer == "gold" else SILVER
    return (base / f"{name}.parquet").as_posix()

def export_json(name: str, sql: str) -> None:
    df = con.execute(sql).df()
    out = OUT_JSON / f"{name}.json"
    df.to_json(out, orient="records", force_ascii=False, date_format="iso")
    print(f"  ✓ {name}.json  ({len(df)} linhas)")

def copy_parquet(name: str, layer="gold") -> None:
    src = GOLD / f"{name}.parquet" if layer == "gold" else SILVER / f"{name}.parquet"
    dst = OUT_PARQ / f"{name}.parquet"
    shutil.copy2(src, dst)
    size = dst.stat().st_size // 1024
    print(f"  ✓ {name}.parquet  ({size} KB)")

print("=== Exportando dados para o dashboard ===\n")

# ── JSON pré-computados (carregamento rápido nas páginas) ─────────────────────

print("→ Classificações históricas")
export_json("classificacao", f"""
    SELECT * FROM read_parquet('{parquet("classificacao_historica")}')
    ORDER BY temporada DESC, pontos DESC
""")

print("→ Campeões")
export_json("campeoes", f"""
    WITH ranked AS (
        SELECT temporada, clube, pontos,
               ROW_NUMBER() OVER (PARTITION BY temporada ORDER BY pontos DESC) AS pos
        FROM read_parquet('{parquet("classificacao_historica")}')
    )
    SELECT temporada, clube, pontos FROM ranked WHERE pos = 1
    ORDER BY temporada DESC
""")

print("→ Partidas (sem escalações, leve)")
export_json("partidas_resumo", f"""
    SELECT partida_id, temporada, rodada,
           CAST(data AS VARCHAR) AS data,
           mandante, gols_mandante, gols_visitante, visitante,
           arena, fonte
    FROM read_parquet('{parquet("campeonato_historico")}')
    ORDER BY temporada DESC, rodada, data
""")

print("→ Artilharia histórica")
export_json("artilharia", f"""
    SELECT temporada, atleta, clube, total_gols AS gols, penaltis, gols_contra
    FROM read_parquet('{parquet("artilharia_historica")}')
    ORDER BY temporada DESC, total_gols DESC
""")

print("→ Fair play")
export_json("fair_play", f"""
    SELECT * FROM read_parquet('{parquet("fair_play")}')
    ORDER BY temporada DESC, pontos_fair_play DESC
""")

print("→ Desempenho de clubes")
export_json("desempenho_clubes", f"""
    SELECT * FROM read_parquet('{parquet("desempenho_clubes")}')
    ORDER BY temporada DESC
""")

print("→ Rebaixamento/acesso")
export_json("rebaixamento_acesso", f"""
    SELECT * FROM read_parquet('{parquet("rebaixamento_acesso")}')
    ORDER BY temporada DESC, posicao
""")

print("→ Gols (silver)")
export_json("gols", f"""
    SELECT * FROM read_parquet('{parquet("gols", "silver")}')
    ORDER BY temporada DESC, partida_id, minuto
""")

print("→ Cartões (silver)")
export_json("cartoes", f"""
    SELECT * FROM read_parquet('{parquet("cartoes", "silver")}')
    ORDER BY temporada DESC, partida_id, minuto
""")

print("→ Estatísticas (silver)")
export_json("estatisticas", f"""
    SELECT * FROM read_parquet('{parquet("estatisticas", "silver")}')
    ORDER BY temporada DESC, partida_id
""")

print("→ Lista de clubes (todos)")
export_json("clubes", f"""
    SELECT DISTINCT mandante AS clube
    FROM read_parquet('{parquet("campeonato_historico")}')
    ORDER BY mandante
""")

print("→ Temporadas disponíveis")
export_json("temporadas_meta", f"""
    SELECT
        temporada,
        COUNT(*) AS total_partidas,
        SUM(CASE WHEN gols_mandante IS NOT NULL THEN gols_mandante + gols_visitante ELSE 0 END) AS total_gols,
        MIN(CAST(data AS VARCHAR)) AS inicio,
        MAX(CAST(data AS VARCHAR)) AS fim
    FROM read_parquet('{parquet("campeonato_historico")}')
    GROUP BY temporada
    ORDER BY temporada DESC
""")

# ── Cópia dos Parquets (usados pelo DuckDB-WASM na página de consultas) ───────
print("\n→ Copiando Parquets para DuckDB-WASM...")
copy_parquet("campeonato_historico")
copy_parquet("classificacao_historica")
copy_parquet("artilharia_historica")
copy_parquet("fair_play")
copy_parquet("rebaixamento_acesso")
copy_parquet("gols",         layer="silver")
copy_parquet("cartoes",      layer="silver")
copy_parquet("estatisticas", layer="silver")

con.close()
print("\n=== Exportação concluída! ===")
