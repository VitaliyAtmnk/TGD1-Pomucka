import { useEffect, useMemo, useState } from "react";
import type { Illustration as IllustrationData } from "../api/types";
import { PROPERTIES, type PropertyResult } from "../viz/properties";
import { edgeByKey, findEdge, frameAt, type Frame } from "../viz/illustration";
import { toGraph, type EdgeState, type EdgeStyle, type NodeState, type NodeStyle } from "../viz/types";
import { GraphView } from "./GraphView";
import { Markdown } from "./Markdown";
import { Button } from "./ui";

function Verdict({ result, question }: { result: PropertyResult; question: string }) {
  return (
    <div
      className={`flex gap-2.5 rounded-md border px-3 py-2 text-[0.95rem] ${
        result.ok ? "border-ok/40 bg-ok-soft" : "border-bad/40 bg-bad-soft"
      }`}
      role="status"
    >
      <span className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-xs font-bold text-[var(--surface)] ${result.ok ? "bg-ok" : "bg-bad"}`} aria-hidden="true">
        {result.ok ? "✓" : "✗"}
      </span>
      <div className="min-w-0">
        <div className="label-caps">{question}</div>
        <Markdown className="[&_p]:my-0">{result.text}</Markdown>
      </div>
    </div>
  );
}

export function IllustrationView({ data }: { data: IllustrationData }) {
  const base = useMemo(() => toGraph(data.graph), [data.graph]);
  const [k, setK] = useState(0);
  const [lab, setLab] = useState<Frame | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [labTool, setLabTool] = useState<"select" | "edges">("select");
  const prop = data.property ? PROPERTIES[data.property] : undefined;
  const interactive = data.interactive ?? !!prop;
  const steps = data.steps;

  useEffect(() => {
    setK(0);
    setLab(null);
  }, [data]);

  const frame = lab ?? frameAt(base, steps, k);
  const step = steps[k];
  const result = prop?.check(frame.graph, frame);

  // styles: explicit highlights of the step, witness of the property, selection
  const nodeStyles: Record<string, NodeStyle> = {};
  const edgeStyles: Record<number, EdgeStyle> = {};
  const explicit = !lab && (Object.keys(step.nodes ?? {}).length > 0 || Object.keys(step.edges ?? {}).length > 0);
  const showWitness = lab ? true : step.witness ?? !explicit;
  if (result && showWitness) {
    Object.assign(nodeStyles, result.nodes ?? {});
    Object.assign(edgeStyles, result.edges ?? {});
  }
  if (!result || !showWitness) {
    frame.set.forEach((v) => (nodeStyles[v] = { state: "done" }));
    frame.edgeSet.forEach((i) => (edgeStyles[i] = { state: "tree" }));
    frame.colors.forEach((c, v) => (nodeStyles[v] = { color: c }));
  }
  if (!lab) {
    for (const [v, s] of Object.entries(step.nodes ?? {})) nodeStyles[v] = { ...nodeStyles[v], state: s as NodeState, color: undefined };
    for (const [key, s] of Object.entries(step.edges ?? {})) {
      const i = edgeByKey(frame.graph, key);
      if (i >= 0) edgeStyles[i] = { state: s as EdgeState };
    }
    for (const [v, l] of Object.entries(step.labels ?? {})) nodeStyles[v] = { ...nodeStyles[v], label: l };
    for (const [key, l] of Object.entries(step.edge_labels ?? {})) {
      const i = edgeByKey(frame.graph, key);
      if (i >= 0) edgeStyles[i] = { ...edgeStyles[i], label: l };
    }
  }
  if (lab && picked) nodeStyles[picked] = { ...nodeStyles[picked], state: "active", color: undefined };

  const selection = prop?.selection ?? "none";
  const editsEdges = !lab ? false : selection === "none" || labTool === "edges";

  function startLab() {
    const f = frameAt(base, steps, k);
    setLab({ graph: f.graph, set: new Set(f.set), edgeSet: new Set(f.edgeSet), colors: new Map(f.colors) });
    setPicked(null);
    setLabTool("select");
  }

  function onNode(id: string) {
    if (!lab) return;
    if (editsEdges) {
      if (!picked) return setPicked(id);
      if (picked === id) return setPicked(null);
      const g = lab.graph;
      const idx = findEdge(g, picked, id);
      const edges = idx >= 0 ? g.edges.filter((_, j) => j !== idx) : [...g.edges, { from: picked, to: id }];
      // edge indices shift on removal – drop the selected-edge set to stay consistent
      setLab({ ...lab, graph: { ...g, edges }, edgeSet: idx >= 0 ? new Set() : lab.edgeSet });
      setPicked(null);
      return;
    }
    if (selection === "nodes") {
      const set = new Set(lab.set);
      if (set.has(id)) set.delete(id);
      else set.add(id);
      setLab({ ...lab, set });
    } else if (selection === "colors") {
      const colors = new Map(lab.colors);
      const c = colors.get(id);
      if (c === undefined) colors.set(id, 0);
      else if (c >= 3) colors.delete(id);
      else colors.set(id, c + 1);
      setLab({ ...lab, colors });
    }
  }

  function onEdge(i: number) {
    if (!lab || selection !== "edges" || labTool !== "select") return;
    const edgeSet = new Set(lab.edgeSet);
    if (edgeSet.has(i)) edgeSet.delete(i);
    else edgeSet.add(i);
    setLab({ ...lab, edgeSet });
  }

  const hint =
    editsEdges
      ? `Klikni na dva uzly – hrana mezi nimi se přidá, nebo odebere${frame.graph.directed ? " (směr od prvního ke druhému)" : ""}.`
      : selection === "nodes"
        ? "Klikáním na uzly je přidáváš do množiny a odebíráš z ní."
        : selection === "edges"
          ? "Klikáním na hrany je vybíráš."
          : "Klikáním na uzel měníš jeho barvu (4 barvy, pak bez barvy).";

  return (
    <figure className="overflow-hidden rounded-lg border border-line bg-surface">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line px-4 py-2.5">
        <span className="font-display font-semibold">{data.title}</span>
        {!lab && steps.length > 1 && (
          <span className="font-mono text-xs text-muted tabular-nums">
            krok {k + 1}/{steps.length}
          </span>
        )}
        {lab && <span className="hand text-lg leading-none text-accent">vyzkoušej sám</span>}
      </figcaption>
      <div className="grid gap-4 p-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="min-w-0 rounded-md bg-bg/60">
          <GraphView
            graph={frame.graph}
            nodeStyles={nodeStyles}
            edgeStyles={edgeStyles}
            showWeights={frame.graph.edges.some((e) => e.w !== undefined)}
            className="max-h-80"
            nodeScale={1.45}
            onNodePointerDown={lab ? (id) => onNode(id) : undefined}
            onEdgeClick={lab && selection === "edges" && labTool === "select" ? onEdge : undefined}
            onBackgroundClick={lab ? () => setPicked(null) : undefined}
            ariaLabel={data.title}
          />
        </div>
        <div className="flex min-w-0 flex-col gap-3">
          {!lab ? <Markdown key={k}>{step.caption}</Markdown> : <p className="text-sm text-muted">{hint}</p>}
          {result && prop && <Verdict result={result} question={prop.question} />}
          <div className="mt-auto flex flex-wrap items-center gap-2">
            {!lab ? (
              <>
                {steps.length > 1 && (
                  <>
                    <Button onClick={() => setK((x) => Math.max(0, x - 1))} disabled={k === 0} aria-label="Předchozí krok">
                      ←
                    </Button>
                    <Button variant={k < steps.length - 1 ? "primary" : "secondary"} onClick={() => setK((x) => Math.min(steps.length - 1, x + 1))} disabled={k === steps.length - 1}>
                      Další krok →
                    </Button>
                    <span className="flex gap-1" aria-hidden="true">
                      {steps.map((_, i) => (
                        <button key={i} onClick={() => setK(i)} className={`h-2 w-2 rounded-full ${i === k ? "bg-accent" : "bg-line"}`} tabIndex={-1} />
                      ))}
                    </span>
                  </>
                )}
                {interactive && (
                  <Button className="ml-auto" onClick={startLab}>
                    Vyzkoušej sám
                  </Button>
                )}
              </>
            ) : (
              <>
                {selection !== "none" && (
                  <div className="inline-flex rounded-md border border-line p-0.5 text-sm">
                    {(["select", "edges"] as const).map((t) => (
                      <button
                        key={t}
                        onClick={() => {
                          setLabTool(t);
                          setPicked(null);
                        }}
                        className={`rounded-sm px-2.5 py-1 font-semibold ${labTool === t ? "bg-ink text-bg" : "text-muted"}`}
                      >
                        {t === "edges" ? "upravit hrany" : selection === "colors" ? "barvit" : "vybírat"}
                      </button>
                    ))}
                  </div>
                )}
                <Button onClick={startLab}>Obnovit</Button>
                <Button className="ml-auto" onClick={() => setLab(null)}>
                  Zpět na výklad
                </Button>
              </>
            )}
          </div>
        </div>
      </div>
    </figure>
  );
}

export function Illustrations({ items, target }: { items?: IllustrationData[]; target: "statement" | "proof" }) {
  const list = (items ?? []).filter((i) => (i.for ?? "statement") === target);
  if (!list.length) return null;
  return (
    <section>
      <h3 className="label-caps mb-2">{target === "proof" ? "Vizualizace důkazu" : list.length > 1 ? "Vizualizace pojmu" : "Vizualizace pojmu"}</h3>
      <div className="space-y-4">
        {list.map((ill, i) => (
          <IllustrationView key={i} data={ill} />
        ))}
      </div>
    </section>
  );
}
