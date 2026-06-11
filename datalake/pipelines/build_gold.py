"""
Gold layer builder — uses DuckDB to query silver Parquet files and produce
pre-computed analytics tables ready for dashboards and notebooks.

Tables produced:
  gold/campeonato_historico.parquet      — all matches enriched
  gold/artilharia_historica.parquet      — goals per player per season
  gold/desempenho_clubes.parquet         — season totals per club
  gold/fair_play.parquet                 — disciplinary records
  gold/classificacao_historica.parquet   — computed standings per season
  gold/rebaixamento_acesso.parquet       — promotion/relegation history
"""
import logging
import duckdb
from pathlib import Path
from config import SILVER_DIR, GOLD_DIR, TEAMS_PER_SEASON, RELEGATION_SPOTS

logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")
log = logging.getLogger(__name__)

GOLD_DIR.mkdir(parents=True, exist_ok=True)


def _silver(table: str) -> str:
    """Return quoted path for DuckDB read_parquet."""
    p = SILVER_DIR / f"{table}.parquet"
    return f"read_parquet('{p.as_posix()}')"


def _write(con: duckdb.DuckDBPyConnection, sql: str, out: Path) -> None:
    log.info("Construindo %s ...", out.name)
    con.execute(f"COPY ({sql}) TO '{out.as_posix()}' (FORMAT PARQUET)")
    result = con.execute(f"SELECT COUNT(*) FROM read_parquet('{out.as_posix()}')").fetchone()
    log.info("  → %d linhas", result[0])


def build_campeonato_historico(con: duckdb.DuckDBPyConnection) -> None:
    sql = f"""
        SELECT
            p.partida_id,
            p.temporada,
            p.rodada,
            p.data,
            p.hora,
            p.mandante,
            p.visitante,
            p.gols_mandante,
            p.gols_visitante,
            p.vencedor,
            p.arena,
            p.formacao_mandante,
            p.formacao_visitante,
            p.tecnico_mandante,
            p.tecnico_visitante,
            p.estado_mandante,
            p.estado_visitante,
            CASE
                WHEN p.gols_mandante > p.gols_visitante THEN 'mandante'
                WHEN p.gols_mandante < p.gols_visitante THEN 'visitante'
                ELSE 'empate'
            END AS resultado,
            p.gols_mandante + p.gols_visitante AS total_gols,
            p.fonte
        FROM {_silver('partidas')} p
        ORDER BY p.temporada, p.rodada, p.partida_id
    """
    _write(con, sql, GOLD_DIR / "campeonato_historico.parquet")


def build_artilharia_historica(con: duckdb.DuckDBPyConnection) -> None:
    # ATENÇÃO: tipo_de_gol é NULL para gols normais na maioria dos registros históricos.
    # LOWER(NULL) = NULL e NULL NOT LIKE '...' = NULL (falso em WHERE), então a condição
    # deve tratar NULL explicitamente para não excluir gols normais.
    sql = f"""
        SELECT
            g.temporada,
            g.atleta,
            g.clube,
            COUNT(*) AS total_gols,
            COUNT(*) FILTER (WHERE g.tipo_de_gol IS NOT NULL
                             AND (LOWER(g.tipo_de_gol) LIKE '%penalty%'
                                  OR LOWER(g.tipo_de_gol) LIKE '%penalti%')) AS penaltis,
            COUNT(*) FILTER (WHERE g.tipo_de_gol IS NOT NULL
                             AND LOWER(g.tipo_de_gol) LIKE '%contra%') AS gols_contra
        FROM {_silver('gols')} g
        WHERE g.atleta IS NOT NULL
          AND g.atleta != ''
          AND (g.tipo_de_gol IS NULL OR LOWER(g.tipo_de_gol) NOT LIKE '%contra%')
        GROUP BY g.temporada, g.atleta, g.clube
        ORDER BY g.temporada, total_gols DESC
    """
    _write(con, sql, GOLD_DIR / "artilharia_historica.parquet")


def build_desempenho_clubes(con: duckdb.DuckDBPyConnection) -> None:
    """Season totals computed from match results (works without API standings)."""
    sql = f"""
        WITH mandante AS (
            SELECT
                temporada,
                mandante AS clube,
                COUNT(*) AS jogos,
                SUM(CASE WHEN gols_mandante > gols_visitante THEN 1 ELSE 0 END) AS vitorias,
                SUM(CASE WHEN gols_mandante = gols_visitante THEN 1 ELSE 0 END) AS empates,
                SUM(CASE WHEN gols_mandante < gols_visitante THEN 1 ELSE 0 END) AS derrotas,
                SUM(gols_mandante)  AS gols_pro,
                SUM(gols_visitante) AS gols_contra
            FROM {_silver('partidas')}
            GROUP BY temporada, mandante
        ),
        visitante AS (
            SELECT
                temporada,
                visitante AS clube,
                COUNT(*) AS jogos,
                SUM(CASE WHEN gols_visitante > gols_mandante THEN 1 ELSE 0 END) AS vitorias,
                SUM(CASE WHEN gols_visitante = gols_mandante THEN 1 ELSE 0 END) AS empates,
                SUM(CASE WHEN gols_visitante < gols_mandante THEN 1 ELSE 0 END) AS derrotas,
                SUM(gols_visitante) AS gols_pro,
                SUM(gols_mandante)  AS gols_contra
            FROM {_silver('partidas')}
            GROUP BY temporada, visitante
        ),
        combined AS (
            SELECT temporada, clube,
                SUM(jogos)       AS jogos,
                SUM(vitorias)    AS vitorias,
                SUM(empates)     AS empates,
                SUM(derrotas)    AS derrotas,
                SUM(gols_pro)    AS gols_pro,
                SUM(gols_contra) AS gols_contra
            FROM (SELECT * FROM mandante UNION ALL SELECT * FROM visitante)
            GROUP BY temporada, clube
        )
        SELECT
            temporada,
            clube,
            jogos,
            vitorias,
            empates,
            derrotas,
            vitorias * 3 + empates AS pontos,
            gols_pro,
            gols_contra,
            gols_pro - gols_contra AS saldo_gols,
            ROUND(vitorias * 1.0 / NULLIF(jogos, 0) * 100, 1) AS aproveitamento_pct
        FROM combined
        ORDER BY temporada, pontos DESC, saldo_gols DESC
    """
    _write(con, sql, GOLD_DIR / "desempenho_clubes.parquet")


def build_fair_play(con: duckdb.DuckDBPyConnection) -> None:
    sql = f"""
        SELECT
            temporada,
            clube,
            COUNT(*) FILTER (WHERE LOWER(cartao) = 'amarelo') AS amarelos,
            COUNT(*) FILTER (WHERE LOWER(cartao) = 'vermelho') AS vermelhos,
            COUNT(*) FILTER (WHERE LOWER(cartao) = 'amarelo') +
            COUNT(*) FILTER (WHERE LOWER(cartao) = 'vermelho') * 3 AS pontos_fair_play,
            COUNT(DISTINCT partida_id) AS partidas_com_cartao
        FROM {_silver('cartoes')}
        WHERE clube IS NOT NULL
        GROUP BY temporada, clube
        ORDER BY temporada, pontos_fair_play DESC
    """
    _write(con, sql, GOLD_DIR / "fair_play.parquet")


def build_classificacao_historica(con: duckdb.DuckDBPyConnection) -> None:
    """
    Compute final standings per season from match results.
    Uses actual API standings when available (silver/classificacao.parquet),
    falls back to computed standings for historical seasons.
    """
    api_path = SILVER_DIR / "classificacao.parquet"

    if api_path.exists():
        # Merge API standings with computed stats
        sql = f"""
            SELECT * FROM {_silver('classificacao')}
            ORDER BY temporada, posicao
        """
    else:
        # Pure computation from results
        sql = f"""
            WITH combined AS (
                SELECT temporada, clube,
                    SUM(jogos)       AS jogos,
                    SUM(vitorias)    AS vitorias,
                    SUM(empates)     AS empates,
                    SUM(derrotas)    AS derrotas,
                    SUM(gols_pro)    AS gols_pro,
                    SUM(gols_contra) AS gols_contra
                FROM (
                    SELECT temporada, mandante AS clube,
                        COUNT(*) jogos,
                        SUM(CASE WHEN gols_mandante > gols_visitante THEN 1 ELSE 0 END) vitorias,
                        SUM(CASE WHEN gols_mandante = gols_visitante THEN 1 ELSE 0 END) empates,
                        SUM(CASE WHEN gols_mandante < gols_visitante THEN 1 ELSE 0 END) derrotas,
                        SUM(gols_mandante) gols_pro, SUM(gols_visitante) gols_contra
                    FROM {_silver('partidas')} GROUP BY temporada, mandante
                    UNION ALL
                    SELECT temporada, visitante AS clube,
                        COUNT(*) jogos,
                        SUM(CASE WHEN gols_visitante > gols_mandante THEN 1 ELSE 0 END) vitorias,
                        SUM(CASE WHEN gols_visitante = gols_mandante THEN 1 ELSE 0 END) empates,
                        SUM(CASE WHEN gols_visitante < gols_mandante THEN 1 ELSE 0 END) derrotas,
                        SUM(gols_visitante) gols_pro, SUM(gols_mandante) gols_contra
                    FROM {_silver('partidas')} GROUP BY temporada, visitante
                )
                GROUP BY temporada, clube
            )
            SELECT
                temporada, clube, jogos, vitorias, empates, derrotas,
                vitorias * 3 + empates AS pontos,
                gols_pro, gols_contra,
                gols_pro - gols_contra AS saldo_gols,
                ROW_NUMBER() OVER (PARTITION BY temporada
                                   ORDER BY pontos DESC, saldo_gols DESC, gols_pro DESC)
                    AS posicao
            FROM combined
            ORDER BY temporada, posicao
        """
    _write(con, sql, GOLD_DIR / "classificacao_historica.parquet")


def build_rebaixamento_acesso(con: duckdb.DuckDBPyConnection) -> None:
    """Derive promotion/relegation from computed final standings."""
    class_path = GOLD_DIR / "classificacao_historica.parquet"
    if not class_path.exists():
        log.warning("classificacao_historica.parquet não encontrada — rode primeiro")
        return

    n_relegated = RELEGATION_SPOTS
    sql = f"""
        WITH ranked AS (
            SELECT
                temporada,
                clube,
                posicao,
                pontos,
                MAX(posicao) OVER (PARTITION BY temporada) AS total_times
            FROM read_parquet('{class_path.as_posix()}')
        )
        SELECT
            temporada,
            clube,
            posicao,
            pontos,
            CASE
                WHEN posicao = 1                               THEN 'Campeão'
                WHEN posicao <= 4                              THEN 'Libertadores'
                WHEN posicao <= 6                              THEN 'Sul-Americana'
                WHEN posicao > total_times - {n_relegated}    THEN 'Rebaixado'
                ELSE 'Manutenção'
            END AS situacao
        FROM ranked
        ORDER BY temporada, posicao
    """
    _write(con, sql, GOLD_DIR / "rebaixamento_acesso.parquet")


def main() -> None:
    log.info("=== Construindo camada Gold ===")

    # Validate silver files exist
    required = ["partidas", "gols", "cartoes"]
    missing = [t for t in required if not (SILVER_DIR / f"{t}.parquet").exists()]
    if missing:
        log.error("Parquet silver ausentes: %s — execute transform_silver.py primeiro", missing)
        raise SystemExit(1)

    con = duckdb.connect()

    build_campeonato_historico(con)
    build_artilharia_historica(con)
    build_desempenho_clubes(con)
    build_fair_play(con)
    build_classificacao_historica(con)
    build_rebaixamento_acesso(con)

    con.close()
    log.info("=== Camada Gold concluída ===")


if __name__ == "__main__":
    main()
