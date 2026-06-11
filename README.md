# Brasileirao Dataset

Dataset completo do Campeonato Brasileiro Série A de 2003 a 2026, com data lake em três camadas e dashboard interativo.

---

## Visão Geral

| Componente | Descrição |
|---|---|
| **CSVs raiz** | Arquivos brutos originais do dataset (2003–2023) |
| **`datalake/`** | Pipeline ETL em Python — bronze → silver → gold |
| **`dashboard/`** | Dashboard Next.js 16 com DuckDB-WASM no browser |

**Cobertura:** 2003–2026 · Série A · ~4.600 partidas  
**Fontes:** Dataset original de Adão Duque (2003–2023) + API-Football via RapidAPI (2024–2026)

---

## Estrutura do Repositório

```
Brasileirao_Dataset-master/
├── campeonato-brasileiro-full.csv          ← partidas (resultados, formações, técnicos)
├── campeonato-brasileiro-estatisticas-full.csv  ← estatísticas por clube por partida
├── campeonato-brasileiro-gols.csv          ← gols por atleta/minuto
├── campeonato-brasileiro-cartoes.csv       ← cartões por atleta/minuto
├── Legenda.txt                             ← dicionário de colunas dos CSVs
├── QUERYS.sql                              ← consultas SQL de exemplo
├── atualizar_rodada.bat                    ← script para atualizar rodada atual (Windows)
├── datalake/                               ← data lake e pipeline ETL
│   ├── bronze/                             ← dados brutos preservados
│   ├── silver/                             ← dados padronizados em Parquet
│   ├── gold/                               ← tabelas analíticas pré-computadas
│   ├── pipelines/                          ← scripts ETL
│   ├── catalog/schema.yaml                 ← dicionário de dados completo
│   ├── .env.example
│   └── requirements.txt
└── dashboard/                              ← dashboard Next.js
    ├── public/data/
    │   ├── json/                           ← 13 arquivos JSON (lidos via fetch)
    │   └── parquet/                        ← 8 arquivos Parquet (lidos via DuckDB-WASM)
    ├── src/
    │   ├── app/                            ← rotas Next.js (App Router)
    │   ├── components/
    │   └── lib/
    └── scripts/export_data.py              ← gera os arquivos de public/data/
```

---

## Dataset CSV (Dados Brutos)

Os quatro CSVs na raiz são o dataset original, prontos para uso direto em Python, SQL ou BI.

### `campeonato-brasileiro-full.csv` — Partidas

| Coluna | Descrição |
|---|---|
| `ID` | ID único da partida |
| `Rodada` | Rodada do campeonato |
| `Data` | Data da partida |
| `Horário` | Horário de início |
| `Dia` | Dia da semana |
| `Mandante` | Clube mandante |
| `Visitante` | Clube visitante |
| `formacao_mandante` | Formação tática do mandante |
| `formacao_visitante` | Formação tática do visitante |
| `tecnico_mandante` | Técnico do mandante |
| `tecnico_visitante` | Técnico do visitante |
| `Vencedor` | Clube vencedor (`-` = empate) |
| `Arena` | Estádio da partida |
| `Mandante Placar` | Gols do mandante |
| `Visitante Placar` | Gols do visitante |
| `Estado Mandante` | Estado do clube mandante |
| `Estado Visitante` | Estado do clube visitante |
| `Estado Vencedor` | Estado do clube vencedor (`-` = empate) |

### `campeonato-brasileiro-estatisticas-full.csv` — Estatísticas

| Coluna | Descrição |
|---|---|
| `partida_ID` | ID da partida |
| `Rodada` | Rodada |
| `Clube` | Nome do clube |
| `Chutes` | Total de finalizações |
| `Chutes a gol` | Finalizações no alvo |
| `Posse de bola` | Posse percentual |
| `Passes` | Total de passes |
| `precisao_passes` | Precisão de passe (%) |
| `Faltas` | Faltas cometidas |
| `cartao_amarelo` | Cartões amarelos |
| `cartao_vermelho` | Cartões vermelhos |
| `Impedimentos` | Impedimentos sofridos |
| `Escanteios` | Escanteios cobrados |

### `campeonato-brasileiro-gols.csv` — Gols

| Coluna | Descrição |
|---|---|
| `partida_ID` | ID da partida |
| `Rodada` | Rodada |
| `Clube` | Clube do marcador |
| `Atleta` | Nome do atleta |
| `Minuto` | Minuto do gol |

### `campeonato-brasileiro-cartoes.csv` — Cartões

| Coluna | Descrição |
|---|---|
| `partida_ID` | ID da partida |
| `Rodada` | Rodada |
| `Clube` | Clube do atleta |
| `Cartao` | Cor do cartão |
| `Atleta` | Nome do atleta |
| `num_camisa` | Número da camisa |
| `Posicao` | Posição em campo |
| `Minuto` | Minuto do cartão |

---

## Data Lake

### Arquitetura

```
bronze/   ← dados brutos preservados (CSVs, JSONs, cache da API)
silver/   ← dados padronizados em Parquet
gold/     ← tabelas analíticas pré-computadas (consumidas pelo dashboard)
```

### Tabelas Gold

| Arquivo | Conteúdo |
|---|---|
| `campeonato_historico.parquet` | Todas as partidas 2003–2026 |
| `artilharia_historica.parquet` | Gols por atleta/temporada |
| `classificacao_historica.parquet` | Classificação final de cada temporada |
| `desempenho_clubes.parquet` | Estatísticas agregadas por clube/temporada |
| `fair_play.parquet` | Ranking de cartões por temporada |
| `rebaixamento_acesso.parquet` | Histórico de rebaixamentos e acessos |

### Cobertura dos Dados

| Tabela | 2003–2011 | 2012–2023 | 2024–2026 |
|---|---|---|---|
| Partidas (resultados) | Completo | Completo | Via API |
| Estatísticas de jogo | Parcial | Completo | Via API |
| Gols / artilharia | Parcial | Completo | Via API |
| Cartões | Parcial | Completo | Via API |
| Escalações | — | — | Via API |
| Classificação | Calculada | Calculada | Via API |

### Instalação

```bash
cd datalake
pip install -r requirements.txt
```

### Configuração da API (2024–2026)

```bash
cp .env.example .env
# edite .env e preencha API_FOOTBALL_KEY
```

Chave obtida em [RapidAPI → api-football](https://rapidapi.com/api-sports/api/api-football). O plano gratuito oferece 100 req/dia — suficiente para atualizações semanais com `--fixtures-only`.

### Executando o Pipeline

```bash
cd datalake/pipelines

# Apenas dados históricos 2003–2023 (sem API)
python run_all.py --skip-api

# Com API — apenas resultados (cota gratuita)
python run_all.py --fixtures-only

# Com API — dados completos: stats, gols, cartões, escalações (plano pago)
python run_all.py
```

### Atualização Semanal (temporada em andamento)

```bash
cd datalake/pipelines

# Apenas novos resultados — 6 req (seguro para cota gratuita)
python update_season.py --fixtures-only --rebuild-gold

# Com detalhes completos
python update_season.py --rebuild-gold
```

No Windows, use `atualizar_rodada.bat` na raiz do projeto.

### Consultas com DuckDB (Python)

```python
import duckdb

con = duckdb.connect()

# Top 10 artilheiros históricos
con.sql("""
    SELECT atleta, clube, SUM(total_gols) AS gols
    FROM 'datalake/gold/artilharia_historica.parquet'
    GROUP BY atleta, clube
    ORDER BY gols DESC
    LIMIT 10
""").df()

# Trajetória do Flamengo
con.sql("""
    SELECT temporada, pontos, vitorias, saldo_gols, aproveitamento_pct
    FROM 'datalake/gold/desempenho_clubes.parquet'
    WHERE clube = 'Flamengo'
    ORDER BY temporada
""").df()

# Histórico de rebaixamentos
con.sql("""
    SELECT temporada, clube, posicao, pontos
    FROM 'datalake/gold/rebaixamento_acesso.parquet'
    WHERE situacao = 'Rebaixado'
    ORDER BY temporada
""").df()
```

---

## Dashboard

Dashboard web com visualizações interativas do histórico do Brasileirão.

### Stack

| Tecnologia | Versão |
|---|---|
| Next.js | 16.2.7 |
| React | 19.2.4 |
| TypeScript | 5 |
| Tailwind CSS | 4 |
| Recharts | 3.8 |
| DuckDB-WASM | 1.33 |

### Rotas

| Rota | Descrição |
|---|---|
| `/` | KPIs gerais, campeões por ano, gols totais/temporada |
| `/temporadas` | Grid de todas as temporadas (2003–2026) |
| `/temporadas/[ano]` | Classificação final + artilharia de uma temporada |
| `/times` | Grid de todos os clubes |
| `/times/[clube]` | Histórico de desempenho do clube (gráfico + tabela) |
| `/confrontos` | Head-to-head entre dois clubes + probabilidades |
| `/consultas` | Editor SQL com DuckDB-WASM executando queries nos Parquets |

### Rodando Localmente

```bash
cd dashboard
npm install
npm run dev
```

Acesse [http://localhost:3000](http://localhost:3000).

### Atualizando os Dados do Dashboard

Após rodar o pipeline ETL, regenere os arquivos de `public/data/`:

```bash
cd dashboard
python scripts/export_data.py
```

### Deploy (Vercel)

```bash
cd dashboard
npm run build
```

O deploy é feito pela Vercel apontando para a pasta `dashboard/`. Os arquivos em `public/data/` (~21 MB) são servidos estaticamente — dentro do limite de 100 MB da Vercel.

---

## Fontes

- **2003–2023:** Dataset original de Adão Duque
- **2024–2026:** [API-Football](https://www.api-football.com) via RapidAPI (Liga ID: `71`)

---

## Catálogo Completo

Consulte [`datalake/catalog/schema.yaml`](datalake/catalog/schema.yaml) para definição completa de todos os campos das tabelas silver e gold.
