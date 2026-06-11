"""
Pipeline orchestrator — runs all steps in order to build the data lake from scratch.

Steps:
  1. ingest_bronze   — copy source CSVs and JSONs to bronze/
  2. transform_silver — convert to Parquet, standardise schema
  3. ingest_2024_2026 — fetch 2024-2026 from API-Football (requires API key)
  4. build_gold       — compute analytics tables

Usage:
    python run_all.py                   # full run (all 4 steps)
    python run_all.py --skip-api        # steps 1-2 + 4 (no API calls)
    python run_all.py --only-gold       # only rebuild gold tables
"""
import argparse
import logging
import sys
import ingest_bronze
import transform_silver
import build_gold
from config import API_FOOTBALL_KEY

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-7s  %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger(__name__)


def run_step(name: str, fn) -> bool:
    log.info("─── Iniciando: %s ───", name)
    try:
        fn()
        log.info("─── Concluído: %s ───\n", name)
        return True
    except Exception as exc:
        log.error("FALHA em %s: %s", name, exc, exc_info=True)
        return False


def main() -> None:
    parser = argparse.ArgumentParser(description="Brasileirao Data Lake — pipeline completo")
    parser.add_argument("--skip-api",  action="store_true",
                        help="Pular ingestão de 2024-2026 (sem chamadas à API)")
    parser.add_argument("--only-gold", action="store_true",
                        help="Apenas reconstruir tabelas Gold")
    parser.add_argument("--fixtures-only", action="store_true",
                        help="Na etapa API, buscar apenas resultados (cota gratuita)")
    args = parser.parse_args()

    if args.only_gold:
        run_step("build_gold", build_gold.main)
        return

    # Step 1 — Bronze
    if not run_step("ingest_bronze", ingest_bronze.main):
        sys.exit(1)

    # Step 2 — Silver
    if not run_step("transform_silver", transform_silver.main):
        sys.exit(1)

    # Step 3 — API (optional)
    if not args.skip_api:
        if not API_FOOTBALL_KEY:
            log.warning(
                "API_FOOTBALL_KEY não configurada — pulando ingestão 2024-2026.\n"
                "  Adicione ao arquivo .env:  API_FOOTBALL_KEY=sua_chave\n"
                "  Ou use --skip-api para suprimir este aviso."
            )
        else:
            import ingest_2024_2026
            fixtures_only = args.fixtures_only

            def _api_step():
                raw = ingest_2024_2026.ingest_partidas(None)     # uses NEW_SEASONS from config
                ingest_2024_2026.ingest_standings(None)
                if not fixtures_only:
                    ingest_2024_2026.ingest_fixture_details(raw)

            run_step("ingest_2024_2026", _api_step)
    else:
        log.info("Pulando ingestão 2024-2026 (--skip-api)")

    # Step 4 — Gold
    run_step("build_gold", build_gold.main)

    log.info("Pipeline completo finalizado.")


if __name__ == "__main__":
    main()
