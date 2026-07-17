# Brasileirao Data Lake

Data lake do Campeonato Brasileiro Série A — 2003 a 2026.

## Estrutura

```
datalake/
├── bronze/               ← dados brutos preservados (CSVs, JSONs, cache da API)
│   ├── csv/
│   ├── json/
│   └── api_cache/
├── silver/               ← dados padronizados em Parquet
│   ├── partidas.parquet
│   ├── estatisticas.parquet
│   ├── gols.parquet
│   ├── cartoes.parquet
│   ├── escalacoes.parquet      (2024+)
│   └── classificacao.parquet  (2024+)
├── gold/                 ← tabelas analíticas pré-computadas
│   ├── campeonato_historico.parquet
│   ├── artilharia_historica.parquet
│   ├── desempenho_clubes.parquet
│   ├── fair_play.parquet
│   ├── classificacao_historica.parquet
│   └── rebaixamento_acesso.parquet
├── pipelines/            ← scripts ETL
├── catalog/
│   └── schema.yaml       ← dicionário de dados completo
├── .env.example
└── requirements.txt
```

## Instalação

```bash
pip install -r requirements.txt
```

## Fonte de dados 2024-2026: Sofascore (gratuita)

`ingest_sofascore.py` busca partidas, gols, cartões, estatísticas e escalações direto da **API pública do Sofascore** (`api.sofascore.com`) — sem chave, sem cota, sem custo. É o pipeline usado pelo `atualizar_rodada.bat` (raiz do projeto) e pela GitHub Action de atualização automática — veja o [README raiz](../README.md#atualização-de-rodada-temporada-2026-em-andamento) para os comandos completos (`--seasons`, `--round`, disparo via `gh workflow run`, etc).

Reexecuções são incrementais: partidas cujos detalhes já estão salvos em `silver/estatisticas.parquet` não são buscadas de novo, e uma rodada só é lida do cache local se todos os seus jogos já estiverem `finished`.

## Uso

### Pipeline completo (primeira execução)

```bash
cd pipelines

# Sem API (apenas dados históricos 2003-2023)
python run_all.py --skip-api
```

### Pipeline legado via RapidAPI (opcional)

`run_all.py`/`update_season.py` também podem usar a [API-Football via RapidAPI](https://rapidapi.com/api-sports/api/api-football) (100 req/dia no plano gratuito) em vez do Sofascore — não é o fluxo usado pelo `.bat` nem pela Action, mas segue disponível:

```bash
cp .env.example .env
# edite .env e adicione sua API_FOOTBALL_KEY

cd pipelines
python run_all.py --fixtures-only        # cota gratuita
python run_all.py                        # plano pago — stats, gols, cartões, escalações
python update_season.py --fixtures-only --rebuild-gold
python update_season.py --rebuild-gold
```

### Consultas com DuckDB

```python
import duckdb

con = duckdb.connect()

# Artilharia histórica
con.sql("""
    SELECT atleta, clube, SUM(total_gols) AS gols
    FROM 'gold/artilharia_historica.parquet'
    GROUP BY atleta, clube
    ORDER BY gols DESC
    LIMIT 10
""").df()

# Desempenho do Flamengo em todas as temporadas
con.sql("""
    SELECT temporada, pontos, vitorias, saldo_gols, aproveitamento_pct
    FROM 'gold/desempenho_clubes.parquet'
    WHERE clube = 'Flamengo'
    ORDER BY temporada
""").df()

# Todas as partidas de 2026
con.sql("""
    SELECT rodada, data, mandante, visitante, gols_mandante, gols_visitante
    FROM 'silver/partidas.parquet'
    WHERE temporada = 2026
    ORDER BY rodada, data
""").df()

# Histórico de rebaixamentos
con.sql("""
    SELECT temporada, clube, posicao, pontos
    FROM 'gold/rebaixamento_acesso.parquet'
    WHERE situacao = 'Rebaixado'
    ORDER BY temporada
""").df()
```

## Cobertura dos dados

| Tabela | 2003-2011 | 2012-2023 | 2024-2026 |
|--------|-----------|-----------|-----------|
| Partidas (resultados) | Completo | Completo | Via API |
| Estatísticas de jogo | Parcial | Completo | Via API |
| Gols (artilharia) | Parcial | Completo | Via API |
| Cartões | Parcial | Completo | Via API |
| Escalações / elencos | Não disponível | Não disponível | Via API |
| Classificação | Calculada | Calculada | Via API |

## Fontes

- **2003–2023:** Dataset original de Adão Duque (adaoduquesn@gmail.com)
- **2024–2026:** [Sofascore](https://www.sofascore.com) (API pública, gratuita) — torneio `325`. Alternativa via [API-Football](https://www.api-football.com)/RapidAPI (Liga ID: `71`) também disponível.

## Catálogo completo

Consulte [catalog/schema.yaml](catalog/schema.yaml) para definição de todos os campos.
