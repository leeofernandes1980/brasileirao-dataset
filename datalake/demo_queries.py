"""
Demonstração de consultas DuckDB no Brasileirao Data Lake.
Execute: python demo_queries.py
"""
import duckdb
from pathlib import Path

GOLD  = Path(__file__).parent / "gold"
SILVER = Path(__file__).parent / "silver"

con = duckdb.connect()


def show(title: str, sql: str) -> None:
    print(f"\n{'=' * 62}")
    print(f"  {title}")
    print('=' * 62)
    df = con.execute(sql).df()
    print(df.to_string(index=False))


# ── ARTILHARIA ───────────────────────────────────────────────────────────────

show("TOP 10 ARTILHEIROS HISTÓRICOS (2003–2023)", f"""
    SELECT atleta, clube, SUM(total_gols) AS gols
    FROM read_parquet('{(GOLD / "artilharia_historica.parquet").as_posix()}')
    GROUP BY atleta, clube
    ORDER BY gols DESC
    LIMIT 10
""")

show("ARTILHEIROS DE 2023", f"""
    SELECT atleta, clube, total_gols AS gols
    FROM read_parquet('{(GOLD / "artilharia_historica.parquet").as_posix()}')
    WHERE temporada = 2023
    ORDER BY gols DESC
    LIMIT 10
""")

# ── CAMPEÕES ─────────────────────────────────────────────────────────────────

show("CAMPEÕES POR TEMPORADA", f"""
    SELECT temporada, clube, pontos, posicao
    FROM read_parquet('{(GOLD / "rebaixamento_acesso.parquet").as_posix()}')
    WHERE situacao = 'Campeão'
    ORDER BY temporada
""")

show("CLUBES COM MAIS TÍTULOS", f"""
    SELECT clube, COUNT(*) AS titulos
    FROM read_parquet('{(GOLD / "rebaixamento_acesso.parquet").as_posix()}')
    WHERE situacao = 'Campeão'
    GROUP BY clube
    ORDER BY titulos DESC
""")

# ── REBAIXAMENTOS ─────────────────────────────────────────────────────────────

show("TODOS OS REBAIXAMENTOS (2003–2023)", f"""
    SELECT temporada, clube, posicao, pontos
    FROM read_parquet('{(GOLD / "rebaixamento_acesso.parquet").as_posix()}')
    WHERE situacao = 'Rebaixado'
    ORDER BY temporada, posicao
""")

# ── DESEMPENHO DE CLUBE ───────────────────────────────────────────────────────

show("FLAMENGO — HISTÓRICO DE DESEMPENHO", f"""
    SELECT temporada, pontos, vitorias, empates, derrotas,
           saldo_gols, aproveitamento_pct
    FROM read_parquet('{(GOLD / "desempenho_clubes.parquet").as_posix()}')
    WHERE clube = 'Flamengo'
    ORDER BY temporada
""")

# ── FAIR PLAY ─────────────────────────────────────────────────────────────────

show("CLUBES MAIS VIOLENTOS — SCORE TOTAL 2003–2023", f"""
    SELECT clube,
           SUM(amarelos)          AS total_amarelos,
           SUM(vermelhos)         AS total_vermelhos,
           SUM(pontos_fair_play)  AS score_punicao
    FROM read_parquet('{(GOLD / "fair_play.parquet").as_posix()}')
    GROUP BY clube
    ORDER BY score_punicao DESC
    LIMIT 10
""")

# ── ESTATÍSTICAS DE PARTIDAS ──────────────────────────────────────────────────

show("PARTIDAS COM MAIS GOLS (TOP 10)", f"""
    SELECT temporada, rodada, mandante, visitante,
           gols_mandante, gols_visitante, total_gols, arena
    FROM read_parquet('{(GOLD / "campeonato_historico.parquet").as_posix()}')
    ORDER BY total_gols DESC
    LIMIT 10
""")

show("MÉDIA DE GOLS POR TEMPORADA", f"""
    SELECT temporada,
           COUNT(*) AS partidas,
           ROUND(AVG(total_gols), 2) AS media_gols_por_jogo,
           SUM(total_gols) AS total_gols
    FROM read_parquet('{(GOLD / "campeonato_historico.parquet").as_posix()}')
    GROUP BY temporada
    ORDER BY temporada
""")

con.close()
print("\nConsultas concluídas.\n")
