import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { api, useApi } from "../api/client";
import type { GraphData, SavedGraph, VisualizationInfo } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import { GraphView } from "../components/GraphView";
import { Markdown } from "../components/Markdown";
import { Button, KindBadge, PageHeader, Segmented } from "../components/ui";
import { ALGORITHM_BY_ID, ALGORITHM_GROUPS, ALGORITHMS } from "../viz/algorithms";
import { sortedIds } from "../viz/algorithms/common";
import { GraphEditor } from "../viz/GraphEditor";
import { StepPlayer } from "../viz/StepPlayer";
import { toGraph, type AlgorithmDef, type Graph } from "../viz/types";

function plainText(md: string) {
  return md.replace(/\$[^$]*\$/g, "…").replace(/\*\*/g, "");
}

function previewGraph(a: AlgorithmDef): Graph {
  const p = a.presets[0];
  return a.displayGraph ? a.displayGraph(p.graph, { ...defaultsOf(a), ...(p.params ?? {}) }) : p.graph;
}

export function VisualizerIndex() {
  const { data: infos } = useApi<VisualizationInfo[]>("/visualizations", { cache: true });
  const planned = (infos ?? []).filter((v) => !ALGORITHM_BY_ID[v.id]);
  return (
    <div>
      <PageHeader
        title="Vizualizace algoritmů"
        subtitle={`${ALGORITHMS.length} algoritmů seřazených podle kapitol. Krokuj je na příkladech ze skript nebo na vlastním grafu.`}
      />
      <div className="space-y-10">
        {ALGORITHM_GROUPS.map((group) => (
          <section key={group.title} aria-label={group.title}>
            <h2 className="label-caps mb-3">{group.title}</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {group.items.map((a) => (
                <Link key={a.id} to={`/vizualizace/${a.id}`} className="group flex flex-col rounded-lg border border-line bg-surface transition hover:border-accent">
                  <div className="border-b border-line p-2">
                    <GraphView graph={previewGraph(a)} showWeights={a.weighted} className="h-32" ariaLabel={`Náhled: ${a.title}`} />
                  </div>
                  <div className="p-4">
                    <h3 className="text-[1.05rem] leading-snug font-bold group-hover:text-accent">{a.title}</h3>
                    <p className="mt-1.5 line-clamp-3 text-sm text-muted">{plainText(a.description)}</p>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
      {planned.length > 0 && (
        <div className="mt-10">
          <h2 className="label-caps mb-2">Připravujeme</h2>
          <div className="flex flex-wrap gap-2">
            {planned.map((p) => (
              <span key={p.id} className="rounded-sm border border-dashed border-line px-3 py-1 text-sm text-muted">
                {p.title}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function randomGraph(a: AlgorithmDef, directed: boolean): Graph {
  const n = 5 + Math.floor(Math.random() * 3);
  const ids = Array.from({ length: n }, (_, i) => String(i + 1));
  const dag = a.id === "critical-path" || a.id === "kernel";
  const nodes = ids.map((id, i) => {
    if (dag) return { id, x: (10 * i) / (n - 1), y: i === 0 || i === n - 1 ? 5 : 1.5 + (i % 2) * 7 + Math.random() };
    const ang = (2 * Math.PI * i) / n - Math.PI / 2;
    return { id, x: 5 + 4.5 * Math.cos(ang), y: 5 + 4.5 * Math.sin(ang) };
  });
  const edges: Graph["edges"] = [];
  const w = () => (a.weighted ? 1 + Math.floor(Math.random() * 9) : undefined);
  for (let i = 1; i < n; i++) {
    const j = dag ? Math.max(0, i - 1 - Math.floor(Math.random() * 2)) : Math.floor(Math.random() * i);
    edges.push({ from: ids[j], to: ids[i], w: w() });
  }
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++) {
      if (i === j || edges.some((e) => (e.from === ids[i] && e.to === ids[j]) || (!directed && e.from === ids[j] && e.to === ids[i])))
        continue;
      if (dag && j < i) continue;
      if (!directed && j < i) continue;
      if (Math.random() < (directed ? 0.18 : 0.25)) edges.push({ from: ids[i], to: ids[j], w: w() });
    }
  return { directed, nodes, edges };
}

export function VisualizerPage() {
  const { id = "" } = useParams();
  const algo = ALGORITHM_BY_ID[id];
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const incoming = (location.state as { graph?: GraphData } | null)?.graph;

  const defaultDirected = algo?.graphKind === "directed";
  const [graph, setGraph] = useState<Graph>(() =>
    incoming ? toGraph(incoming, algo?.graphKind === "any" ? undefined : defaultDirected) : algo?.presets[0].graph,
  );
  const [params, setParams] = useState<Record<string, string>>(() => ({ ...defaultsOf(algo), ...(algo?.presets[0].params ?? {}) }));
  const [mode, setMode] = useState<"run" | "edit">("run");
  const [presetIdx, setPresetIdx] = useState(incoming ? -1 : 0);

  const { data: infos } = useApi<VisualizationInfo[]>("/visualizations", { cache: true });
  const related = infos?.find((v) => v.id === id)?.items ?? [];
  const saved = useApi<SavedGraph[]>(user && algo?.editable !== false ? "/graphs" : null, { deps: [user?.id] });

  useEffect(() => {
    if (!algo) return;
    if (!incoming) {
      setGraph(algo.presets[0].graph);
      setParams({ ...defaultsOf(algo), ...(algo.presets[0].params ?? {}) });
      setPresetIdx(0);
    }
    setMode("run");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const editable = algo?.editable !== false;
  const error =
    algo?.validate?.(graph, params) ?? (!editable || graph?.nodes.length ? null : "Graf je prázdný – přidej uzly v režimu úprav.");
  const shown = useMemo(() => (algo?.displayGraph && !error ? algo.displayGraph(graph, params) : graph), [algo, graph, params, error]);
  const steps = useMemo(() => {
    if (!algo || error) return [];
    try {
      return algo.run(graph, params);
    } catch (e) {
      console.error(e);
      return [];
    }
  }, [algo, graph, params, error]);

  if (!algo) {
    return (
      <div>
        <p className="mb-4">Tato vizualizace zatím neexistuje.</p>
        <Link to="/vizualizace" className="text-accent underline">
          Zpět na seznam vizualizací
        </Link>
      </div>
    );
  }
  const pseudo = typeof algo.pseudocode === "function" ? algo.pseudocode(params) : algo.pseudocode;
  const nodeIds = graph ? sortedIds(graph) : [];
  const textParams = algo.params.filter((p) => p.type === "text");
  const otherParams = algo.params.filter((p) => p.type !== "text");

  async function save() {
    const name = window.prompt("Název grafu:", `${algo.short} – můj graf`);
    if (!name) return;
    await api("/graphs", { method: "POST", json: { name, data: graph } });
    saved.reload();
  }

  return (
    <div>
      <nav className="mb-4 flex flex-wrap items-center gap-2 text-sm" aria-label="Drobečková navigace">
        <Link to="/vizualizace" className="text-muted hover:text-ink">
          Vizualizace
        </Link>
        <span className="text-muted">/</span>
        <select
          id="algo-select"
          className="rounded-md border border-line bg-surface px-2 py-1 font-semibold"
          value={id}
          onChange={(e) => navigate(`/vizualizace/${e.target.value}`)}
          aria-label="Algoritmus"
        >
          {ALGORITHM_GROUPS.map((g) => (
            <optgroup key={g.title} label={g.title}>
              {g.items.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.title}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </nav>
      <h1 className="mb-2 text-[2rem] leading-tight font-bold">{algo.title}</h1>
      <Markdown className="mb-5 max-w-[80ch] text-muted">{algo.description}</Markdown>

      <div className="mb-5 rounded-lg border border-line bg-surface p-4">
        <div className="flex flex-wrap items-end gap-3">
          {editable && (
            <Segmented
              value={mode}
              onChange={setMode}
              options={[
                { value: "run", label: "Spustit" },
                { value: "edit", label: "Upravit graf" },
              ]}
            />
          )}
          <label className="text-sm">
            <span className="label-caps mb-1 block">Příklad</span>
            <select
              id="preset-select"
              className="rounded-md border border-line bg-surface px-2 py-1.5"
              value={presetIdx}
              onChange={(e) => {
                const k = Number(e.target.value);
                if (k >= 0) {
                  setPresetIdx(k);
                  setGraph(algo.presets[k].graph);
                  setParams({ ...defaultsOf(algo), ...(algo.presets[k].params ?? {}) });
                } else if (k <= -10 && saved.data) {
                  const sg = saved.data[-k - 10];
                  setPresetIdx(k);
                  setGraph(toGraph(sg.data));
                }
              }}
            >
              {presetIdx === -1 && <option value={-1}>(vlastní vstup)</option>}
              {algo.presets.map((p, k) => (
                <option key={k} value={k}>
                  {p.name}
                </option>
              ))}
              {saved.data && saved.data.length > 0 && (
                <optgroup label="Moje uložené grafy">
                  {saved.data.map((sg, k) => (
                    <option key={sg.id} value={-10 - k}>
                      {sg.name}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </label>
          {otherParams.map((p) => (
            <label key={p.key} className="text-sm">
              <span className="label-caps mb-1 block">{p.label}</span>
              <select
                id={`param-${p.key}`}
                className="rounded-md border border-line bg-surface px-2 py-1.5"
                value={p.type === "node" ? resolveParam(params[p.key], nodeIds, p.default) : params[p.key] ?? p.default}
                onChange={(e) => setParams({ ...params, [p.key]: e.target.value })}
              >
                {(p.type === "node" ? nodeIds.map((v) => ({ value: v, label: v })) : p.options ?? []).map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          ))}
          {editable && (
            <div className="ml-auto flex flex-wrap gap-2">
              <Button
                onClick={() => {
                  setGraph(randomGraph(algo, algo.graphKind === "directed" || (algo.graphKind === "any" && graph.directed)));
                  setPresetIdx(-1);
                }}
              >
                Náhodný graf
              </Button>
              {user && (
                <Button onClick={save} title="Uložit graf do účtu">
                  Uložit graf
                </Button>
              )}
            </div>
          )}
        </div>
        {textParams.map((p) => (
          <label key={p.key} className="mt-3 block text-sm">
            <span className="label-caps mb-1 block">{p.label}</span>
            <input
              id={`param-${p.key}`}
              className="w-full rounded-md border border-line bg-bg px-3 py-2 font-mono text-[0.95rem] outline-none focus:border-accent"
              value={params[p.key] ?? ""}
              placeholder={p.placeholder}
              spellCheck={false}
              onChange={(e) => {
                setParams({ ...params, [p.key]: e.target.value });
                setPresetIdx(-1);
              }}
            />
            {p.help && <span className="mt-1 block text-xs text-muted">{p.help}</span>}
          </label>
        ))}
      </div>

      {mode === "edit" && editable ? (
        <div className="max-w-3xl">
          <GraphEditor
            graph={graph}
            onChange={(g) => {
              setGraph(g);
              setPresetIdx(-1);
            }}
            weighted={algo.weighted}
            weightLabel={algo.weightLabel}
            allowDirectedToggle={algo.graphKind === "any"}
          />
          <Button variant="primary" className="mt-3" onClick={() => setMode("run")}>
            Spustit algoritmus
          </Button>
        </div>
      ) : error ? (
        <div className="rounded-lg border border-warn/50 bg-warn-soft p-4 text-warn">
          <Markdown>{error}</Markdown>
        </div>
      ) : (
        <StepPlayer graph={shown} steps={steps} pseudocode={pseudo} weighted={algo.weighted} />
      )}

      {related.length > 0 && (
        <div className="mt-10">
          <h2 className="label-caps mb-2">Související látka</h2>
          <div className="flex flex-wrap gap-2">
            {related.map((it) => (
              <Link
                key={it.id}
                to={`/pojem/${it.id}`}
                className="inline-flex items-center gap-2 rounded-md border border-line bg-surface px-3 py-2 text-sm hover:border-accent"
              >
                <KindBadge kind={it.kind} label={it.label} />
                {it.title}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function defaultsOf(a: AlgorithmDef | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  a?.params.forEach((p) => {
    if (p.type !== "node" && p.default) out[p.key] = p.default;
  });
  return out;
}

function resolveParam(v: string | undefined, ids: string[], def?: string) {
  if (v && ids.includes(v)) return v;
  if (def && ids.includes(def)) return def;
  return def === "last" ? ids[ids.length - 1] : ids[0];
}
