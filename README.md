# Brasileirao Dataset

Dataset completo do Campeonato Brasileiro Série A de 2003 a 2026, com data lake em três camadas e dashboard interativo.

---

## Visão Geral

| Componente | Descrição |
|---|---|
| **CSVs raiz** | Arquivos brutos originais do dataset (2003–2023) |
| **`datalake/`** | Pipeline ETL em Python — bronze → silver → gold |
| **`dashboard/`** | Dashboard Next.js 16 com DuckDB-WASM no browser |

**Cobertura:** 2003–2026 · Série A · 9.500+ partidas  
**Fontes:** Dataset original de Adão Duque (2003–2023) + API pública do Sofascore, gratuita (2024–2026)

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

### Executando o Pipeline

```bash
cd datalake/pipelines

# Apenas dados históricos 2003–2023 (sem API)
python run_all.py --skip-api
```

### Atualização de Rodada (temporada 2026 em andamento)

O fluxo atual usa `ingest_sofascore.py`, que consome a **API pública gratuita do Sofascore** — sem chave, sem cota, sem custo.

```bash
cd datalake/pipelines

# Partidas + gols/cartões/estatísticas/escalações da temporada 2026
# (só busca o que ainda não foi salvo — rápido em execuções repetidas)
python ingest_sofascore.py --seasons 2026

# Só uma rodada específica
python ingest_sofascore.py --seasons 2026 --round 19

# Depois, reconstrua a camada Gold e exporte para o dashboard
python build_gold.py
cd ../../dashboard/scripts && python export_data.py
```

No Windows, `atualizar_rodada.bat` (raiz do projeto) faz tudo isso em sequência, incluindo a carga no MySQL local.

#### Atualização automática (GitHub Actions)

O workflow [`.github/workflows/atualizar-rodada.yml`](.github/workflows/atualizar-rodada.yml) roda esse mesmo fluxo na nuvem a cada 3 horas e publica direto no site (commit + push para `main`, o que dispara o deploy no Vercel). Também pode ser disparado manualmente pelo terminal, com o [GitHub CLI](https://cli.github.com/):

```bash
# Verifica todas as rodadas e atualiza o que houver de novo
gh workflow run "Atualizar Rodada Brasileirão"

# Atualiza só uma rodada específica
gh workflow run "Atualizar Rodada Brasileirão" -f rodada=19

# Acompanhar a execução mais recente até o fim
gh run watch $(gh run list --workflow="Atualizar Rodada Brasileirão" --limit 1 --json databaseId -q '.[0].databaseId') --exit-status
```

Não precisa de nenhuma chave/segredo — a API do Sofascore usada aqui é pública e gratuita.

### Pipeline legado via RapidAPI (opcional)

`run_all.py` e `update_season.py` usam a [API-Football via RapidAPI](https://rapidapi.com/api-sports/api/api-football) (plano gratuito: 100 req/dia) em vez do Sofascore. Não é o fluxo usado pelo `.bat` nem pela GitHub Action, mas continua disponível como alternativa:

```bash
cp datalake/.env.example datalake/.env
# edite .env e preencha API_FOOTBALL_KEY

cd datalake/pipelines
python update_season.py --fixtures-only --rebuild-gold   # só resultados
python update_season.py --rebuild-gold                   # com stats, gols, cartões, escalações
```

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
- **2024–2026:** [Sofascore](https://www.sofascore.com) (API pública, gratuita) — torneio `325`. Alternativa via [API-Football](https://www.api-football.com)/RapidAPI (Liga ID: `71`) também disponível.

---

## Catálogo Completo

Consulte [`datalake/catalog/schema.yaml`](datalake/catalog/schema.yaml) para definição completa de todos os campos das tabelas silver e gold.
