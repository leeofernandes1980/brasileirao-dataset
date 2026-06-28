# Testando o banco no MySQL Workbench

Conexão: `127.0.0.1:3306`, usuário `root`, senha `310783`, banco `brasileirao_datalake`.

Cole os blocos abaixo em uma aba SQL do Workbench (Ctrl+Enter executa o statement onde está o cursor).

## 1. Conectividade e inventário

```sql
-- Confirma que está no banco certo
SELECT DATABASE();

-- Lista todas as tabelas e views
SHOW TABLES;

-- Contagem de linhas de cada tabela principal
SELECT
  (SELECT COUNT(*) FROM partidas)      AS partidas,
  (SELECT COUNT(*) FROM estatisticas)  AS estatisticas,
  (SELECT COUNT(*) FROM gols)          AS gols,
  (SELECT COUNT(*) FROM cartoes)       AS cartoes,
  (SELECT COUNT(*) FROM escalacoes)    AS escalacoes;
```

## 2. Tabelas Gold

```sql
SELECT temporada, COUNT(*) AS total
FROM campeonato_historico
GROUP BY temporada
ORDER BY temporada DESC;

SELECT * FROM v_campeoes ORDER BY temporada DESC;

SELECT * FROM v_artilharia_geral LIMIT 20;

SELECT * FROM v_media_gols_temporada ORDER BY temporada DESC;
```

## 3. Classificação

```sql
-- Classificação 2026 (temporada em andamento)
SELECT
  ROW_NUMBER() OVER (ORDER BY pontos DESC, vitorias DESC) AS pos,
  clube, pontos, vitorias AS V, empates AS E, derrotas AS D,
  gols_pro AS GP, gols_contra AS GC, (gols_pro - gols_contra) AS SG
FROM classificacao_historica
WHERE temporada = 2026
ORDER BY pontos DESC, vitorias DESC;
```

## 4. Partidas e confrontos

```sql
-- Últimos jogos cadastrados
SELECT temporada, rodada, data, mandante, gols_mandante, gols_visitante, visitante, status
FROM partidas
ORDER BY data DESC
LIMIT 20;

-- Clássico São Paulo x Corinthians
SELECT temporada, data, rodada, mandante, gols_mandante, gols_visitante, visitante
FROM partidas
WHERE (mandante = 'São Paulo' AND visitante = 'Corinthians')
   OR (mandante = 'Corinthians' AND visitante = 'São Paulo')
ORDER BY data;

-- Maiores goleadas da história
SELECT temporada, data, mandante, gols_mandante, gols_visitante, visitante,
       ABS(gols_mandante - gols_visitante) AS diferenca
FROM partidas
WHERE gols_mandante IS NOT NULL
ORDER BY diferenca DESC, (gols_mandante + gols_visitante) DESC
LIMIT 10;
```

## 5. Desempenho histórico de clubes

```sql
SELECT
  clube,
  SUM(pontos)   AS pontos_total,
  SUM(vitorias) AS vitorias,
  SUM(empates)  AS empates,
  SUM(derrotas) AS derrotas,
  COUNT(*)      AS temporadas
FROM classificacao_historica
GROUP BY clube
ORDER BY pontos_total DESC
LIMIT 20;

-- Evolução de um clube específico (troque 'Flamengo')
SELECT temporada, pontos, vitorias, empates, derrotas, gols_pro, gols_contra,
       (gols_pro - gols_contra) AS saldo
FROM classificacao_historica
WHERE clube = 'Flamengo'
ORDER BY temporada;
```

## 6. Estatísticas e cartões

```sql
-- Médias de posse/chutes/escanteios por temporada
SELECT
  p.temporada,
  ROUND(AVG(e.posse_de_bola), 1) AS media_posse,
  ROUND(AVG(e.chutes), 1)        AS media_chutes,
  ROUND(AVG(e.escanteios), 1)    AS media_escanteios
FROM estatisticas e
JOIN partidas p ON e.partida_id = p.partida_id
GROUP BY p.temporada
ORDER BY p.temporada DESC;

-- Partidas com mais cartões
SELECT p.data, p.mandante, p.gols_mandante, p.gols_visitante, p.visitante,
       COUNT(c.partida_id) AS total_cartoes
FROM cartoes c
JOIN partidas p ON c.partida_id = p.partida_id
GROUP BY p.partida_id, p.data, p.mandante, p.gols_mandante, p.gols_visitante, p.visitante
ORDER BY total_cartoes DESC
LIMIT 10;
```

Mais exemplos (rivalidades, rebaixamento, window functions) estão em [`QUERYS.sql`](QUERYS.sql) na raiz do projeto.
