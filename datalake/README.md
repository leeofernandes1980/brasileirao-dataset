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

## Configuração da API

Para obter dados de 2024-2026, você precisa de uma chave da API-Football:

1. Crie uma conta em [RapidAPI](https://rapidapi.com)
2. Assine o plano gratuito de [api-football](https://rapidapi.com/api-sports/api/api-football)
3. Copie `.env.example` para `.env` e preencha sua chave:

```bash
cp .env.example .env
# edite .env e adicione sua API_FOOTBALL_KEY
```

**Plano gratuito:** 100 requisições/dia — suficiente para buscar resultados semanalmente com `--fixtures-only`.

## Uso

### Pipeline completo (primeira execução)

```bash
cd pipelines

# Sem API (apenas dados históricos 2003-2023)
python run_all.py --skip-api

# Com API (inclui 2024-2026, apenas resultados — cota gratuita)
python run_all.py --fixtures-only

# Com API + detalhes completos (stats, gols, cartões, escalações — requer plano pago)
python run_all.py
```

### Atualização semanal do Brasileirão 2026

```bash
cd pipelines

# Apenas novos resultados (6 req — seguro para cota gratuita)
python update_season.py --fixtures-only --rebuild-gold

# Com detalhes (stats, gols, escalações por partida)
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
- **2024–2026:** [API-Football](https://www.api-football.com) via RapidAPI — Liga ID: `71`

## Catálogo completo

Consulte [catalog/schema.yaml](catalog/schema.yaml) para definição de todos os campos.
