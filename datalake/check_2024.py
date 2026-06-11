import duckdb
from pathlib import Path

silver = (Path(__file__).parent / "silver" / "partidas.parquet").resolve().as_posix()

con = duckdb.connect()
sql = f"""
    SELECT partida_id, temporada, rodada,
           CAST(data AS VARCHAR) AS data,
           mandante, visitante,
           gols_mandante, gols_visitante,
           arena, status, fonte
    FROM read_parquet('{silver}')
    WHERE temporada = 2024 AND rodada = 1
    ORDER BY data
"""
df = con.execute(sql).df()
print(f"\nRodada 1 / 2024 — {len(df)} partidas\n")
print(df.to_string(index=False))
con.close()
