-- Quantas partidas por temporada
SELECT temporada, COUNT(*) AS total
FROM partidas
GROUP BY temporada
ORDER BY temporada DESC;

-- Classificação 2026
SELECT clube, pontos, vitorias, empates, derrotas
FROM classificacao_historica
WHERE temporada = 2026
ORDER BY pontos DESC;

-- Campeões históricos
SELECT * FROM v_campeoes ORDER BY temporada DESC;

SELECT data, mandante, gols_mandante, gols_visitante, visitante,
       (gols_mandante + gols_visitante) AS total_gols
FROM partidas
WHERE gols_mandante IS NOT NULL
ORDER BY total_gols DESC
LIMIT 10;

SELECT temporada, data, rodada, gols_mandante, gols_visitante
FROM partidas
WHERE (mandante = 'São Paulo' AND visitante = 'Corinthians')
   OR (mandante = 'Corinthians' AND visitante = 'São Paulo')
ORDER BY data;


SELECT temporada, COUNT(*) AS total
FROM partidas
GROUP BY temporada
ORDER BY temporada DESC;

1.1 Exploração inicial
Total de partidas no banco:
SELECT COUNT(*) AS total_partidas FROM partidas;
Total de partidas por temporada (mais recentes primeiro):
SELECT temporada, COUNT(*) AS total
FROM partidas
GROUP BY temporada
ORDER BY temporada DESC;
Primeiras 10 partidas da rodada 1 de 2024:
SELECT rodada, data, mandante, gols_mandante, gols_visitante, visitante, arena
FROM partidas
WHERE temporada = 2024 AND rodada = 1
ORDER BY data;
Partidas com mais gols na história:
SELECT data, mandante, gols_mandante, gols_visitante, visitante,
       (gols_mandante + gols_visitante) AS total_gols
FROM partidas
WHERE gols_mandante IS NOT NULL
ORDER BY total_gols DESC
LIMIT 10;
1.2 Filtragem e condições
Todos os jogos do Flamengo em 2024:
SELECT data, rodada, mandante, gols_mandante, gols_visitante, visitante
FROM partidas
WHERE temporada = 2024
  AND (mandante = 'Flamengo' OR visitante = 'Flamengo')
ORDER BY data;
Clássicos São Paulo x Corinthians ao longo da história:
SELECT temporada, data, rodada, gols_mandante, gols_visitante
FROM partidas
WHERE (mandante = 'São Paulo' AND visitante = 'Corinthians')
   OR (mandante = 'Corinthians' AND visitante = 'São Paulo')
ORDER BY data;
Partidas encerradas com resultado (apenas jogos finalizados):
SELECT temporada, data, mandante, gols_mandante, gols_visitante, visitante
FROM partidas
WHERE status = 'finished'
ORDER BY data DESC
LIMIT 20;
 
Nível 2 — Agregações e Agrupamentos
2.1 Classificação e pontuação
Classificação completa de 2024 (com pontos calculados):
SELECT
    ROW_NUMBER() OVER (ORDER BY pontos DESC, vitorias DESC) AS pos,
    clube,
    pontos,
    vitorias AS V,
    empates  AS E,
    derrotas AS D,
    gols_pro   AS GP,
    gols_contra AS GC,
    (gols_pro - gols_contra) AS SG
FROM classificacao_historica
WHERE temporada = 2024
ORDER BY pontos DESC, vitorias DESC;
Classificação parcial de 2026 (temporada em andamento):
SELECT
    ROW_NUMBER() OVER (ORDER BY pontos DESC, vitorias DESC) AS pos,
    clube, pontos, vitorias AS V, empates AS E, derrotas AS D
FROM classificacao_historica
WHERE temporada = 2026
ORDER BY pontos DESC, vitorias DESC;
Campeões históricos (usando a view pronta):
SELECT * FROM v_campeoes ORDER BY temporada DESC;
Quantas vezes cada clube foi campeão:
SELECT clube, COUNT(*) AS titulos
FROM v_campeoes
GROUP BY clube
ORDER BY titulos DESC;
2.2 Análise de gols
Média de gols por jogo em cada temporada:
SELECT * FROM v_media_gols_temporada ORDER BY temporada DESC;
Temporada com mais gols no total:
SELECT temporada,
       SUM(gols_mandante + gols_visitante) AS total_gols,
       COUNT(*) AS partidas,
       ROUND(SUM(gols_mandante + gols_visitante) / COUNT(*), 2) AS media
FROM partidas
WHERE gols_mandante IS NOT NULL
GROUP BY temporada
ORDER BY total_gols DESC;
Artilharia histórica — top 20 goleadores:
SELECT * FROM v_artilharia_geral LIMIT 20;
Artilharia de 2024 (temporada completa):
SELECT atleta, clube, SUM(1) AS gols, temporada
FROM gols
WHERE temporada = 2024
GROUP BY atleta, clube, temporada
ORDER BY gols DESC
LIMIT 20;
 
Nível 3 — Análises Avançadas
3.1 Desempenho histórico de clubes
Aproveitamento histórico de todos os clubes (total de pontos e % aproveitamento):
SELECT
    clube,
    SUM(pontos)   AS pontos_total,
    SUM(vitorias) AS vitorias,
    SUM(empates)  AS empates,
    SUM(derrotas) AS derrotas,
    COUNT(*)      AS temporadas,
    ROUND(SUM(pontos) / (COUNT(*) * 114) * 100, 1) AS aproveitamento_pct
FROM classificacao_historica
GROUP BY clube
ORDER BY pontos_total DESC
LIMIT 20;
Evolução do Flamengo temporada a temporada:
SELECT temporada, pontos, vitorias, empates, derrotas,
       gols_pro, gols_contra,
       (gols_pro - gols_contra) AS saldo
FROM classificacao_historica
WHERE clube = 'Flamengo'
ORDER BY temporada;
Times que mais sofreram rebaixamentos:
SELECT clube, COUNT(*) AS rebaixamentos
FROM v_rebaixados
GROUP BY clube
ORDER BY rebaixamentos DESC
LIMIT 15;
3.2 Análise de partidas em casa vs. fora
Aproveitamento mandante vs. visitante por temporada:
SELECT
    temporada,
    COUNT(*) AS partidas,
    SUM(CASE WHEN gols_mandante > gols_visitante THEN 1 ELSE 0 END) AS vit_mandante,
    SUM(CASE WHEN gols_mandante = gols_visitante THEN 1 ELSE 0 END) AS empates,
    SUM(CASE WHEN gols_mandante < gols_visitante THEN 1 ELSE 0 END) AS vit_visitante,
    ROUND(SUM(CASE WHEN gols_mandante > gols_visitante THEN 1 ELSE 0 END)
          / COUNT(*) * 100, 1) AS pct_casa
FROM partidas
WHERE gols_mandante IS NOT NULL
GROUP BY temporada
ORDER BY temporada DESC;
Clubes com melhor aproveitamento como visitante (histórico):
SELECT
    visitante AS clube,
    COUNT(*) AS jogos_fora,
    SUM(CASE WHEN gols_visitante > gols_mandante THEN 1 ELSE 0 END) AS vitorias_fora,
    ROUND(SUM(CASE WHEN gols_visitante > gols_mandante THEN 1 ELSE 0 END)
          / COUNT(*) * 100, 1) AS pct_vitoria_fora
FROM partidas
WHERE gols_mandante IS NOT NULL AND status = 'finished'
GROUP BY visitante
HAVING jogos_fora >= 50
ORDER BY pct_vitoria_fora DESC
LIMIT 15;
 
3.3 Estatísticas de partidas
Médias de estatísticas por temporada (posse, chutes, escanteios):
SELECT
    p.temporada,
    ROUND(AVG(e.posse_de_bola), 1)    AS media_posse,
    ROUND(AVG(e.chutes), 1)           AS media_chutes,
    ROUND(AVG(e.escanteios), 1)       AS media_escanteios,
    ROUND(AVG(e.faltas), 1)           AS media_faltas
FROM estatisticas e
JOIN partidas p ON e.partida_id = p.partida_id
GROUP BY p.temporada
ORDER BY p.temporada DESC;
Partidas com mais cartões:
SELECT
    p.data, p.mandante, p.gols_mandante, p.gols_visitante, p.visitante,
    COUNT(c.partida_id) AS total_cartoes,
    SUM(CASE WHEN c.cartao = 'Vermelho' THEN 1 ELSE 0 END) AS vermelhos
FROM cartoes c
JOIN partidas p ON c.partida_id = p.partida_id
GROUP BY p.partida_id, p.data, p.mandante, p.gols_mandante, p.gols_visitante, p.visitante
ORDER BY total_cartoes DESC
LIMIT 10;
3.4 Window Functions (funções analíticas)
Ranking de pontos dentro de cada temporada (top 4 e zona de rebaixamento):
SELECT
    temporada, clube, pontos,
    RANK() OVER (PARTITION BY temporada ORDER BY pontos DESC) AS posicao,
    CASE
        WHEN RANK() OVER (PARTITION BY temporada ORDER BY pontos DESC) <= 4
             THEN 'Libertadores'
        WHEN RANK() OVER (PARTITION BY temporada ORDER BY pontos DESC) <= 6
             THEN 'Sul-Americana'
        WHEN RANK() OVER (PARTITION BY temporada ORDER BY pontos DESC) >= 17
             THEN 'Rebaixamento'
        ELSE ''
    END AS zona
FROM classificacao_historica
WHERE temporada = 2024
ORDER BY pontos DESC;
Diferença de pontos entre campeão e vice por temporada:
WITH ranked AS (
    SELECT temporada, clube, pontos,
           RANK() OVER (PARTITION BY temporada ORDER BY pontos DESC) AS pos
    FROM classificacao_historica
),
campeao AS (SELECT temporada, clube, pontos FROM ranked WHERE pos = 1),
vice    AS (SELECT temporada, clube, pontos FROM ranked WHERE pos = 2)
SELECT c.temporada, c.clube AS campeao, c.pontos AS pts_campeao,
       v.clube AS vice, v.pontos AS pts_vice,
       (c.pontos - v.pontos) AS diferenca
FROM campeao c
JOIN vice v ON c.temporada = v.temporada
ORDER BY c.temporada DESC;
 
Nível 4 — Análises Especiais
4.1 Rivalidades históricas
Retrospecto completo entre Flamengo e Fluminense (Fla-Flu):
SELECT
    COUNT(*) AS jogos,
    SUM(CASE WHEN mandante='Flamengo'   AND gols_mandante > gols_visitante THEN 1
             WHEN visitante='Flamengo'  AND gols_visitante > gols_mandante THEN 1
             ELSE 0 END) AS vitorias_fla,
    SUM(CASE WHEN gols_mandante = gols_visitante THEN 1 ELSE 0 END) AS empates,
    SUM(CASE WHEN mandante='Fluminense' AND gols_mandante > gols_visitante THEN 1
             WHEN visitante='Fluminense' AND gols_visitante > gols_mandante THEN 1
             ELSE 0 END) AS vitorias_flu,
    SUM(gols_mandante + gols_visitante) AS total_gols
FROM partidas
WHERE ((mandante = 'Flamengo'   AND visitante = 'Fluminense')
    OR (mandante = 'Fluminense' AND visitante = 'Flamengo'))
  AND gols_mandante IS NOT NULL;
Confronto direto entre dois times quaisquer (altere os nomes):
SET @time1 = 'Palmeiras';
SET @time2 = 'Corinthians';

SELECT temporada, data, rodada, mandante, gols_mandante, gols_visitante, visitante
FROM partidas
WHERE ((mandante = @time1 AND visitante = @time2)
    OR (mandante = @time2 AND visitante = @time1))
  AND gols_mandante IS NOT NULL
ORDER BY data;
4.2 Maiores goleadas da história
Top 10 goleadas com maior diferença de placar:
SELECT
    temporada, data, mandante, gols_mandante, gols_visitante, visitante,
    ABS(gols_mandante - gols_visitante) AS diferenca
FROM partidas
WHERE gols_mandante IS NOT NULL
ORDER BY diferenca DESC, (gols_mandante + gols_visitante) DESC
LIMIT 10;
4.3 Sequências e consistência
Clubes que mais vezes ficaram no G4 (top 4) ao longo da história:
SELECT clube, COUNT(*) AS vezes_no_g4
FROM rebaixamento_acesso
WHERE posicao <= 4
GROUP BY clube
ORDER BY vezes_no_g4 DESC
LIMIT 10;
Temporadas com maior média de público (se disponível) ou mais gols por rodada:
SELECT
    temporada,
    rodada,
    SUM(gols_mandante + gols_visitante) AS gols_rodada,
    COUNT(*) AS partidas
FROM partidas
WHERE gols_mandante IS NOT NULL
GROUP BY temporada, rodada
ORDER BY gols_rodada DESC
LIMIT 15;
4.4 Análise de 2026 (temporada em andamento)
Situação atual de 2026 — apenas jogos finalizados:
SELECT
    ROW_NUMBER() OVER (ORDER BY
        (3 * SUM(CASE WHEN gols_mandante > gols_visitante THEN 1
                      WHEN gols_visitante > gols_mandante THEN 0
                      ELSE 1 END) -- empate mandante
              + SUM(CASE WHEN gols_mandante = gols_visitante THEN 1 ELSE 0 END))
        DESC) AS pos,
    mandante AS clube,
    COUNT(*) AS jogos,
    SUM(CASE WHEN gols_mandante > gols_visitante THEN 1 ELSE 0 END) AS V,
    SUM(CASE WHEN gols_mandante = gols_visitante THEN 1 ELSE 0 END) AS E,
    SUM(CASE WHEN gols_mandante < gols_visitante THEN 1 ELSE 0 END) AS D
FROM partidas
WHERE temporada = 2026 AND status = 'finished'
GROUP BY mandante
ORDER BY V DESC, E DESC;
Forma recente — últimas 5 partidas de cada time em 2026:
SELECT p.mandante AS clube, p.rodada, p.gols_mandante AS gf, p.gols_visitante AS gc,
       CASE WHEN p.gols_mandante > p.gols_visitante THEN 'V'
            WHEN p.gols_mandante = p.gols_visitante THEN 'E'
            ELSE 'D' END AS resultado
FROM partidas p
WHERE p.temporada = 2026 AND p.status = 'finished'
  AND p.mandante IN ('Palmeiras','Flamengo','Fluminense','Botafogo','São Paulo')
ORDER BY p.mandante, p.rodada DESC;

#Dicas e Referência Rápida
#Filtros úteis para a coluna 'status'
Use na cláusula WHERE para controlar quais jogos incluir:
-- Apenas jogos já encerrados (use para análises históricas)
WHERE status = 'finished'

-- Jogos agendados / futuros (temporada 2026)
WHERE status = 'notStarted'

-- Sem filtro: inclui todos (histórico + agendados)
Nomes dos clubes mais usados
SELECT DISTINCT mandante AS clube FROM partidas ORDER BY mandante;
-- Exemplos comuns: Flamengo, Palmeiras, Corinthians, São Paulo, Botafogo,
--   Fluminense, Internacional, Grêmio, Atlético Mineiro, Cruzeiro,
--   Athletico, Vasco da Gama, Santos, Bahia, Fortaleza
#Template para análise de qualquer clube
-- Substitua 'Palmeiras' pelo clube desejado
SELECT
    c.temporada,
    c.pontos,
    c.vitorias AS V, c.empates AS E, c.derrotas AS D,
    c.gols_pro AS GP, c.gols_contra AS GC,
    (c.gols_pro - c.gols_contra) AS SG,
    r.posicao AS classificacao_final
FROM classificacao_historica c
LEFT JOIN rebaixamento_acesso r
       ON c.temporada = r.temporada AND c.clube = r.clube
WHERE c.clube = 'Palmeiras'
ORDER BY c.temporada;
#Como atualizar os dados de 2026
#Os dados de 2026 são atualizados executando o pipeline Python novamente. No terminal, dentro da pasta do projeto:
-- No terminal (cmd/PowerShell), dentro da pasta datalake/pipelines/:
#python ingest_sofascore.py --seasons 2026 --fixtures-only
#python build_gold.py
#python load_mysql.py



