"use client";
import { useEffect, useState, useRef } from "react";
import { Play, RotateCcw, Database } from "lucide-react";

const EXEMPLOS = [
  {
    label: "Campeões históricos",
    sql: `SELECT temporada, clube, pontos
FROM classificacao_historica
ORDER BY temporada DESC, pontos DESC`,
  },
  {
    label: "Artilharia 2024",
    sql: `SELECT atleta, clube, total_gols AS gols
FROM artilharia_historica
WHERE temporada = 2024
ORDER BY total_gols DESC
LIMIT 20`,
  },
  {
    label: "Goleadas históricas",
    sql: `SELECT temporada, mandante, gols_mandante, gols_visitante, visitante,
       ABS(gols_mandante - gols_visitante) AS diferenca
FROM campeonato_historico
WHERE gols_mandante IS NOT NULL
ORDER BY diferenca DESC, (gols_mandante + gols_visitante) DESC
LIMIT 10`,
  },
  {
    label: "Times mais disciplinados",
    sql: `SELECT clube, temporada, amarelos, vermelhos
FROM fair_play
WHERE temporada = 2024
ORDER BY pontos_fair_play ASC
LIMIT 10`,
  },
  {
    label: "Confronto Fla x Flu",
    sql: `SELECT temporada, mandante, gols_mandante, gols_visitante, visitante
FROM campeonato_historico
WHERE (mandante = 'Flamengo' AND visitante = 'Fluminense')
   OR (mandante = 'Fluminense' AND visitante = 'Flamengo')
ORDER BY temporada DESC`,
  },
];

export default function Consultas() {
  const [db, setDb] = useState<any>(null);
  const [sql, setSql] = useState(EXEMPLOS[0].sql);
  const [rows, setRows] = useState<any[]>([]);
  const [cols, setCols] = useState<string[]>([]);
  const [erro, setErro] = useState("");
  const [loading, setLoading] = useState(false);
  const [dbLoading, setDbLoading] = useState(true);
  const [tempo, setTempo] = useState<number | null>(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    async function init() {
      try {
        const duckdb = await import("@duckdb/duckdb-wasm");
        const bundles = duckdb.getJsDelivrBundles();
        const bundle  = await duckdb.selectBundle(bundles);
        // Blob URL evita bloqueio de CORS ao criar Worker com URL cross-origin
        const workerResp = await fetch(bundle.mainWorker!);
        const workerBlob = await workerResp.blob();
        const workerUrl  = URL.createObjectURL(workerBlob);
        const worker  = new Worker(workerUrl);
        const logger  = new duckdb.ConsoleLogger();
        const dbInst  = new duckdb.AsyncDuckDB(logger, worker);
        await dbInst.instantiate(bundle.mainModule);

        const conn = await dbInst.connect();

        const tabelas = [
          { nome: "campeonato_historico",   arquivo: "campeonato_historico" },
          { nome: "classificacao_historica",arquivo: "classificacao_historica" },
          { nome: "artilharia_historica",   arquivo: "artilharia_historica" },
          { nome: "fair_play",              arquivo: "fair_play" },
          { nome: "rebaixamento_acesso",    arquivo: "rebaixamento_acesso" },
          { nome: "gols",                   arquivo: "gols" },
          { nome: "cartoes",                arquivo: "cartoes" },
          { nome: "estatisticas",           arquivo: "estatisticas" },
        ];

        for (const t of tabelas) {
          const url = `${window.location.origin}/data/parquet/${t.arquivo}.parquet`;
          await dbInst.registerFileURL(`${t.arquivo}.parquet`, url, 4, false);
          await conn.query(
            `CREATE VIEW IF NOT EXISTS ${t.nome} AS
             SELECT * FROM read_parquet('${t.arquivo}.parquet')`
          );
        }

        await conn.close();
        setDb(dbInst);
      } catch (e: any) {
        setErro("Erro ao inicializar DuckDB: " + e.message);
      } finally {
        setDbLoading(false);
      }
    }
    init();
  }, []);

  async function executar() {
    if (!db || !sql.trim()) return;
    setLoading(true);
    setErro("");
    setRows([]);
    setCols([]);
    const t0 = performance.now();
    try {
      const conn   = await db.connect();
      const result = await conn.query(sql);
      await conn.close();
      const schema = result.schema.fields.map((f: any) => f.name);
      const data   = result.toArray().map((r: any) => {
        const obj: any = {};
        schema.forEach((col: string) => { obj[col] = r[col]; });
        return obj;
      });
      setCols(schema);
      setRows(data);
      setTempo(Math.round(performance.now() - t0));
    } catch (e: any) {
      setErro(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Database size={20} style={{ color: "#b388ff" }} />
        <h1 className="text-2xl font-bold" style={{ color: "var(--fg)" }}>Consultas SQL</h1>
        <span className="badge-blue ml-1">DuckDB-WASM · browser</span>
      </div>

      {dbLoading && (
        <div className="card text-center py-10 text-sm" style={{ color: "var(--muted)" }}>
          Carregando banco de dados (primeira vez ~10s)...
        </div>
      )}

      {!dbLoading && (
        <>
          {/* exemplos */}
          <div className="flex gap-2 flex-wrap">
            {EXEMPLOS.map(e => (
              <button key={e.label} onClick={() => setSql(e.sql)}
                className="text-xs px-3 py-1.5 rounded-full transition-colors"
                style={{ background: "rgba(179,136,255,.12)", color: "#b388ff", border: "1px solid rgba(179,136,255,.25)" }}>
                {e.label}
              </button>
            ))}
          </div>

          {/* editor */}
          <div className="card">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-mono" style={{ color: "var(--muted)" }}>SQL</span>
              <div className="flex gap-2 items-center">
                <button onClick={() => { setSql(""); setRows([]); setCols([]); setErro(""); }}
                  className="flex items-center gap-1 text-xs transition-colors"
                  style={{ color: "var(--muted)" }}>
                  <RotateCcw size={12} /> Limpar
                </button>
                <button onClick={executar} disabled={loading}
                  className="flex items-center gap-1.5 text-sm font-semibold px-4 py-1.5 rounded-lg
                             disabled:opacity-40 transition-all"
                  style={{ background: "rgba(0,210,91,.15)", color: "var(--green)", border: "1px solid rgba(0,210,91,.3)" }}>
                  <Play size={13} />
                  {loading ? "Executando..." : "Executar"}
                </button>
              </div>
            </div>
            <textarea
              value={sql}
              onChange={e => setSql(e.target.value)}
              onKeyDown={e => { if (e.ctrlKey && e.key === "Enter") executar(); }}
              rows={6}
              className="w-full font-mono text-sm rounded-lg p-3 resize-y focus:outline-none"
              style={{
                background: "var(--bg)", border: "1px solid var(--border)",
                color: "var(--fg)", caretColor: "var(--accent)",
              }}
              placeholder="SELECT * FROM campeonato_historico LIMIT 10"
              spellCheck={false}
            />
            <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>Ctrl+Enter para executar</p>
          </div>

          {/* erro */}
          {erro && (
            <div className="card text-sm font-mono"
              style={{ borderColor: "rgba(233,69,96,.4)", background: "rgba(233,69,96,.08)", color: "var(--red)" }}>
              {erro}
            </div>
          )}

          {/* resultado */}
          {cols.length > 0 && (
            <div className="card overflow-auto">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold" style={{ color: "var(--fg)" }}>
                  {rows.length} linhas retornadas
                </span>
                {tempo && <span className="text-xs" style={{ color: "var(--muted)" }}>{tempo}ms</span>}
              </div>
              <table className="table-auto w-full">
                <thead>
                  <tr>{cols.map(c => <th key={c}>{c}</th>)}</tr>
                </thead>
                <tbody>
                  {rows.slice(0, 200).map((row, i) => (
                    <tr key={i}>
                      {cols.map(c => (
                        <td key={c} className="max-w-xs truncate">
                          {row[c] == null
                            ? <span style={{ color: "var(--border)" }}>null</span>
                            : String(row[c])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length > 200 && (
                <p className="text-xs mt-2" style={{ color: "var(--muted)" }}>
                  Exibindo primeiros 200 de {rows.length} resultados.
                </p>
              )}
            </div>
          )}

          {/* tabelas */}
          <div className="card">
            <h3 className="text-sm font-semibold mb-2" style={{ color: "var(--fg)" }}>Tabelas disponíveis</h3>
            <div className="flex flex-wrap gap-2">
              {["campeonato_historico","classificacao_historica","artilharia_historica",
                "fair_play","rebaixamento_acesso","gols","cartoes","estatisticas"]
                .map(t => (
                  <code key={t} className="text-xs px-2 py-1 rounded"
                    style={{ background: "var(--bg-hover)", color: "#b388ff" }}>
                    {t}
                  </code>
                ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
