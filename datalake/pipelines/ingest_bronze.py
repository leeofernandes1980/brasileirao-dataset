"""
Bronze ingestion — copies original CSVs and JSONs into the bronze layer,
preserving them unchanged as the immutable source of truth.
"""
import shutil
import logging
from pathlib import Path
from config import SOURCE_CSVS, SOURCE_JSON_DIR, BRONZE_DIR

logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")
log = logging.getLogger(__name__)


def copy_csvs() -> None:
    dest = BRONZE_DIR / "csv"
    dest.mkdir(parents=True, exist_ok=True)

    for name, src in SOURCE_CSVS.items():
        if not src.exists():
            log.warning("Arquivo não encontrado: %s", src)
            continue
        target = dest / src.name
        shutil.copy2(src, target)
        size_kb = target.stat().st_size / 1024
        log.info("CSV copiado  %-45s  %.1f KB", src.name, size_kb)


def copy_jsons() -> None:
    dest = BRONZE_DIR / "json"
    dest.mkdir(parents=True, exist_ok=True)

    if not SOURCE_JSON_DIR.exists():
        log.warning("Diretório JSON não encontrado: %s", SOURCE_JSON_DIR)
        return

    for src in sorted(SOURCE_JSON_DIR.glob("brasileirao-*.json")):
        target = dest / src.name
        shutil.copy2(src, target)
        size_kb = target.stat().st_size / 1024
        log.info("JSON copiado  %-45s  %.1f KB", src.name, size_kb)


def main() -> None:
    log.info("=== Ingestão Bronze iniciada ===")
    copy_csvs()
    copy_jsons()
    log.info("=== Ingestão Bronze concluída ===")


if __name__ == "__main__":
    main()
