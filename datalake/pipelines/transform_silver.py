"""
Silver transformation — reads bronze CSVs, standardises schemas,
derives the `temporada` column, and writes clean Parquet files.

Covers the historical data: 2003–2023.
New seasons (2024-2026) are handled by ingest_2024_2026.py.
"""
import logging
import pandas as pd
from pathlib import Path
from config import BRONZE_DIR, SILVER_DIR

logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")
log = logging.getLogger(__name__)

SILVER_DIR.mkdir(parents=True, exist_ok=True)


# ── helpers ──────────────────────────────────────────────────────────────────

def _read_csv(path: Path) -> pd.DataFrame:
    """Read CSV trying UTF-8 first, then latin-1."""
    for enc in ("utf-8-sig", "utf-8", "latin-1"):
        try:
            return pd.read_csv(path, encoding=enc, low_memory=False)
        except UnicodeDecodeError:
            continue
    raise ValueError(f"Não foi possível decodificar {path}")


def _safe_int(series: pd.Series) -> pd.Series:
    return pd.to_numeric(series, errors="coerce").fillna(0).astype("Int64")


def _safe_float(series: pd.Series) -> pd.Series:
    cleaned = series.astype(str).str.replace("%", "", regex=False).str.strip()
    return pd.to_numeric(cleaned, errors="coerce")


# ── partidas ─────────────────────────────────────────────────────────────────

def transform_partidas() -> None:
    src = BRONZE_DIR / "csv" / "campeonato-brasileiro-full.csv"
    if not src.exists():
        log.warning("Arquivo não encontrado: %s", src)
        return

    df = _read_csv(src)

    # Standardise column names
    df.columns = [
        "partida_id", "rodada", "data", "hora",
        "mandante", "visitante",
        "formacao_mandante", "formacao_visitante",
        "tecnico_mandante", "tecnico_visitante",
        "vencedor", "arena",
        "gols_mandante", "gols_visitante",
        "estado_mandante", "estado_visitante",
    ]

    df["data"]         = pd.to_datetime(df["data"], format="%d/%m/%Y", errors="coerce")
    df["temporada"]    = df["data"].dt.year.astype("Int64")
    # O Brasileirão 2020 foi disputado até fev/2021 por causa da pandemia.
    # Rodadas 28-38 com datas em jan-mar/2021 pertencem à temporada 2020.
    # Qualquer jogo com data em jan-mar/2021 pertence ao Brasileirão 2020 (pandemia)
    # O Brasileirão 2021 só começou em maio/2021
    mask_2020_tardio = (df["temporada"] == 2021) & (df["data"].dt.month <= 3)
    df.loc[mask_2020_tardio, "temporada"] = 2020
    df["rodada"]       = _safe_int(df["rodada"])
    df["gols_mandante"]  = _safe_int(df["gols_mandante"])
    df["gols_visitante"] = _safe_int(df["gols_visitante"])
    df["partida_id"]   = _safe_int(df["partida_id"])

    for col in ("mandante", "visitante", "vencedor", "arena",
                "tecnico_mandante", "tecnico_visitante",
                "formacao_mandante", "formacao_visitante",
                "estado_mandante", "estado_visitante"):
        df[col] = df[col].astype(str).str.strip().replace("nan", pd.NA)

    df["fonte"] = "historico_csv"

    out = SILVER_DIR / "partidas.parquet"
    df.to_parquet(out, index=False, engine="pyarrow")
    log.info("partidas.parquet  →  %d linhas  (%d temporadas)",
             len(df), df["temporada"].nunique())


# ── estatísticas ─────────────────────────────────────────────────────────────

def transform_estatisticas() -> None:
    src = BRONZE_DIR / "csv" / "campeonato-brasileiro-estatisticas-full.csv"
    if not src.exists():
        log.warning("Arquivo não encontrado: %s", src)
        return

    df = _read_csv(src)

    df.columns = [
        "partida_id", "rodada", "clube",
        "chutes", "chutes_no_alvo", "posse_de_bola",
        "passes", "precisao_passes",
        "faltas", "cartao_amarelo", "cartao_vermelho",
        "impedimentos", "escanteios",
    ]

    df["partida_id"]      = _safe_int(df["partida_id"])
    df["rodada"]          = _safe_int(df["rodada"])
    df["chutes"]          = _safe_int(df["chutes"])
    df["chutes_no_alvo"]  = _safe_int(df["chutes_no_alvo"])
    df["passes"]          = _safe_int(df["passes"])
    df["faltas"]          = _safe_int(df["faltas"])
    df["cartao_amarelo"]  = _safe_int(df["cartao_amarelo"])
    df["cartao_vermelho"] = _safe_int(df["cartao_vermelho"])
    df["impedimentos"]    = _safe_int(df["impedimentos"])
    df["escanteios"]      = _safe_int(df["escanteios"])
    df["posse_de_bola"]   = _safe_float(df["posse_de_bola"])
    df["precisao_passes"] = _safe_float(df["precisao_passes"])
    df["clube"]           = df["clube"].astype(str).str.strip()

    # Derive temporada by joining with partidas
    partidas_path = SILVER_DIR / "partidas.parquet"
    if partidas_path.exists():
        partidas = pd.read_parquet(partidas_path, columns=["partida_id", "temporada"])
        df = df.merge(partidas, on="partida_id", how="left")
    else:
        df["temporada"] = pd.NA

    df["fonte"] = "historico_csv"

    out = SILVER_DIR / "estatisticas.parquet"
    df.to_parquet(out, index=False, engine="pyarrow")
    log.info("estatisticas.parquet  →  %d linhas", len(df))


# ── gols ─────────────────────────────────────────────────────────────────────

def transform_gols() -> None:
    src = BRONZE_DIR / "csv" / "campeonato-brasileiro-gols.csv"
    if not src.exists():
        log.warning("Arquivo não encontrado: %s", src)
        return

    df = _read_csv(src)

    # Handle variable number of columns (tipo_de_gol may be missing)
    if len(df.columns) == 6:
        df.columns = ["partida_id", "rodada", "clube", "atleta", "minuto", "tipo_de_gol"]
    elif len(df.columns) == 5:
        df.columns = ["partida_id", "rodada", "clube", "atleta", "minuto"]
        df["tipo_de_gol"] = pd.NA
    else:
        df.columns = list(df.columns[:6])

    df["partida_id"] = _safe_int(df["partida_id"])
    df["rodada"]     = _safe_int(df["rodada"])
    df["minuto"]     = df["minuto"].astype(str).str.extract(r"(\d+)")[0]
    df["minuto"]     = _safe_int(df["minuto"])
    df["clube"]      = df["clube"].astype(str).str.strip()
    df["atleta"]     = df["atleta"].astype(str).str.strip()

    partidas_path = SILVER_DIR / "partidas.parquet"
    if partidas_path.exists():
        partidas = pd.read_parquet(partidas_path, columns=["partida_id", "temporada"])
        df = df.merge(partidas, on="partida_id", how="left")
    else:
        df["temporada"] = pd.NA

    df["fonte"] = "historico_csv"

    out = SILVER_DIR / "gols.parquet"
    df.to_parquet(out, index=False, engine="pyarrow")
    log.info("gols.parquet  →  %d linhas", len(df))


# ── cartões ──────────────────────────────────────────────────────────────────

def transform_cartoes() -> None:
    src = BRONZE_DIR / "csv" / "campeonato-brasileiro-cartoes.csv"
    if not src.exists():
        log.warning("Arquivo não encontrado: %s", src)
        return

    df = _read_csv(src)

    df.columns = [
        "partida_id", "rodada", "clube",
        "cartao", "atleta", "num_camisa", "posicao", "minuto",
    ]

    df["partida_id"]  = _safe_int(df["partida_id"])
    df["rodada"]      = _safe_int(df["rodada"])
    df["clube"]       = df["clube"].astype(str).str.strip()
    df["cartao"]      = df["cartao"].astype(str).str.strip()
    df["atleta"]      = df["atleta"].astype(str).str.strip()
    df["num_camisa"]  = df["num_camisa"].astype(str).str.strip()
    df["posicao"]     = df["posicao"].astype(str).str.strip()
    df["minuto"]      = df["minuto"].astype(str).str.extract(r"(\d+)")[0]
    df["minuto"]      = _safe_int(df["minuto"])

    partidas_path = SILVER_DIR / "partidas.parquet"
    if partidas_path.exists():
        partidas = pd.read_parquet(partidas_path, columns=["partida_id", "temporada"])
        df = df.merge(partidas, on="partida_id", how="left")
    else:
        df["temporada"] = pd.NA

    df["fonte"] = "historico_csv"

    out = SILVER_DIR / "cartoes.parquet"
    df.to_parquet(out, index=False, engine="pyarrow")
    log.info("cartoes.parquet  →  %d linhas", len(df))


# ── main ─────────────────────────────────────────────────────────────────────

def main() -> None:
    log.info("=== Transformação Silver iniciada ===")
    transform_partidas()       # must run first — others derive temporada from it
    transform_estatisticas()
    transform_gols()
    transform_cartoes()
    log.info("=== Transformação Silver concluída ===")


if __name__ == "__main__":
    main()
