"""
Carrega todas as tabelas silver e gold (Parquet) no MySQL.

Cria o banco `brasileirao_datalake` se não existir, depois faz
REPLACE de cada tabela — seguro para rodar quantas vezes quiser.

Uso:
    python load_mysql.py              # carrega silver + gold
    python load_mysql.py --only gold  # só gold
    python load_mysql.py --only silver
"""
import argparse
import logging
import os
import sys
from pathlib import Path

import pandas as pd
import pymysql
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent.parent / ".env")

logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")
log = logging.getLogger(__name__)

SILVER_DIR = Path(__file__).parent.parent / "silver"
GOLD_DIR   = Path(__file__).parent.parent / "gold"

# ── conexão ──────────────────────────────────────────────────────────────────

def _build_engine(database: str | None = None):
    host = os.getenv("MYSQL_HOST",     "localhost")
    port = os.getenv("MYSQL_PORT",     "3306")
    user = os.getenv("MYSQL_USER",     "root")
    pwd  = os.getenv("MYSQL_PASSWORD", "")
    db   = database if database is not None else os.getenv("MYSQL_DATABASE", "brasileirao_datalake")
    # db="" → conecta sem banco (para CREATE DATABASE)
    db_part = f"/{db}" if db else ""
    return create_engine(
        f"mysql+pymysql://{user}:{pwd}@{host}:{port}{db_part}?charset=utf8mb4",
        pool_pre_ping=True,
    )


def ensure_database() -> None:
    """Cria o banco de dados se não existir."""
    db_name = os.getenv("MYSQL_DATABASE", "brasileirao_datalake")
    engine  = _build_engine(database="")   # sem banco na URL
    with engine.connect() as con:
        con.execute(text(
            f"CREATE DATABASE IF NOT EXISTS `{db_name}` "
            "CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
        ))
        con.commit()
    log.info("Banco '%s' pronto.", db_name)
    engine.dispose()


# ── carga ─────────────────────────────────────────────────────────────────────

SILVER_TABLES = [
    ("partidas",     "partida_id"),
    ("estatisticas", None),
    ("gols",         None),
    ("cartoes",      None),
    ("escalacoes",   None),
    ("classificacao",None),
]

GOLD_TABLES = [
    ("campeonato_historico",     "partida_id"),
    ("artilharia_historica",     None),
    ("desempenho_clubes",        None),
    ("fair_play",                None),
    ("classificacao_historica",  None),
    ("rebaixamento_acesso",      None),
]

INDEXES = {
    # tabela → lista de (nome_idx, colunas)
    "partidas":    [("idx_part_temp",  "temporada"), ("idx_part_clube", "mandante,visitante(64)")],
    "gols":        [("idx_gol_temp",   "temporada"), ("idx_gol_atleta", "atleta(64)")],
    "cartoes":     [("idx_cart_temp",  "temporada"), ("idx_cart_clube", "clube(64)")],
    "desempenho_clubes":       [("idx_desemp_temp", "temporada"), ("idx_desemp_clube","clube(64)")],
    "artilharia_historica":    [("idx_art_temp",    "temporada"), ("idx_art_atleta",  "atleta(64)")],
    "classificacao_historica": [("idx_class_temp",  "temporada"), ("idx_class_pos",   "posicao")],
    "rebaixamento_acesso":     [("idx_reb_temp",    "temporada"), ("idx_reb_sit",      "situacao(32)")],
    "campeonato_historico":    [("idx_camp_temp",   "temporada")],
}


def _load_table(engine, parquet_path: Path, table_name: str, pk_col: str | None) -> None:
    if not parquet_path.exists():
        log.warning("  Parquet não encontrado, pulando: %s", parquet_path.name)
        return

    df = pd.read_parquet(parquet_path)

    # Converte tipos pandas nullable (Int64, boolean) → tipos nativos do MySQL
    for col in df.columns:
        if pd.api.types.is_integer_dtype(df[col]):
            df[col] = df[col].astype("object").where(df[col].notna(), other=None)
        elif pd.api.types.is_bool_dtype(df[col]):
            df[col] = df[col].astype("object").where(df[col].notna(), other=None)

    # Garante que colunas de texto não excedam 191 chars (índices utf8mb4)
    str_cols = df.select_dtypes(include=["object", "string"]).columns
    for c in str_cols:
        df[c] = df[c].astype(str).where(df[c].notna(), other=None)

    df.to_sql(
        name=table_name,
        con=engine,
        if_exists="replace",
        index=False,
        chunksize=500,
        method="multi",
    )
    log.info("  %-35s  %d linhas", table_name, len(df))


def _add_indexes(engine, tables: list[tuple]) -> None:
    with engine.connect() as con:
        for table_name, _ in tables:
            if table_name not in INDEXES:
                continue
            for idx_name, cols in INDEXES[table_name]:
                try:
                    con.execute(text(
                        f"CREATE INDEX `{idx_name}` ON `{table_name}` ({cols})"
                    ))
                    con.commit()
                except Exception:
                    pass  # índice já existe


def _create_views(engine) -> None:
    """Views úteis para consultas no Workbench."""
    views = {
        "v_artilharia_geral": """
            SELECT atleta, clube,
                   SUM(total_gols) AS gols_historico
            FROM artilharia_historica
            GROUP BY atleta, clube
            ORDER BY gols_historico DESC
        """,
        "v_campeoes": """
            SELECT temporada, clube, pontos, posicao
            FROM rebaixamento_acesso
            WHERE situacao = 'Campeão'
            ORDER BY temporada
        """,
        "v_rebaixados": """
            SELECT temporada, clube, posicao, pontos
            FROM rebaixamento_acesso
            WHERE situacao = 'Rebaixado'
            ORDER BY temporada, posicao
        """,
        "v_desempenho_geral": """
            SELECT clube,
                   COUNT(DISTINCT temporada) AS temporadas,
                   SUM(pontos)               AS pontos_total,
                   SUM(vitorias)             AS vitorias_total,
                   SUM(gols_pro)             AS gols_pro_total,
                   SUM(gols_contra)          AS gols_contra_total,
                   ROUND(AVG(aproveitamento_pct), 1) AS aproveitamento_medio
            FROM desempenho_clubes
            GROUP BY clube
            ORDER BY pontos_total DESC
        """,
        "v_media_gols_temporada": """
            SELECT temporada,
                   COUNT(*) AS partidas,
                   ROUND(AVG(total_gols), 2) AS media_gols,
                   SUM(total_gols) AS total_gols
            FROM campeonato_historico
            GROUP BY temporada
            ORDER BY temporada
        """,
    }

    with engine.connect() as con:
        for vname, vsql in views.items():
            con.execute(text(f"DROP VIEW IF EXISTS `{vname}`"))
            con.execute(text(f"CREATE VIEW `{vname}` AS {vsql}"))
            con.commit()
            log.info("  View criada: %s", vname)


# ── main ──────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--only", choices=["silver", "gold"], default=None,
                        help="Carregar apenas silver ou apenas gold")
    args = parser.parse_args()

    log.info("=== Carga MySQL iniciada ===")
    ensure_database()

    engine = _build_engine()

    if args.only != "gold":
        log.info("--- Tabelas Silver ---")
        for table, pk in SILVER_TABLES:
            _load_table(engine, SILVER_DIR / f"{table}.parquet", table, pk)

    if args.only != "silver":
        log.info("--- Tabelas Gold ---")
        for table, pk in GOLD_TABLES:
            _load_table(engine, GOLD_DIR / f"{table}.parquet", table, pk)

    log.info("--- Criando índices ---")
    _add_indexes(engine, SILVER_TABLES + GOLD_TABLES)

    log.info("--- Criando views ---")
    _create_views(engine)

    engine.dispose()
    log.info("=== Carga MySQL concluída ===")


if __name__ == "__main__":
    main()
