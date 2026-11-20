import { useEffect, useRef, useState } from "react";
import { GraphView } from "../components/GraphView";
import { Button } from "../components/ui";
import type { Graph } from "./types";

interface Props {
  graph: Graph;
  onChange: (g: Graph) => void;
  weighted: boolean;
  weightLabel?: string;
  allowDirectedToggle: boolean;
}

function nextId(g: Graph) {
  const used = new Set(g.nodes.map((n) => n.id));
  const numeric = g.nodes.length === 0 || g.nodes.every((n) => /^\d+$/.test(n.id));
  if (numeric) {
    let i = 1;
    while (used.has(String(i))) i++;
    return String(i);
  }
  for (const c of "abcdefghijklmnopqrstuvwxyz") if (!used.has(c)) return c;
  let i = 1;
  while (used.has(`v${i}`)) i++;
  return `v${i}`;
}

export function GraphEditor({ graph, onChange, weighted, weightLabel = "w", allowDirectedToggle }: Props) {
  const [selNode, setSelNode] = useState<string | null>(null);
  const [selEdge, setSelEdge] = useState<number | null>(null);
  const drag = useRef<{ id: string; moved: boolean } | null>(null);
  const graphRef = useRef(graph);
  graphRef.current = graph;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.target as HTMLElement).tagName === "INPUT") return;
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selEdge !== null) deleteEdge(selEdge);
        else if (selNode) deleteNode(selNode);
      }
      if (e.key === "Escape") {
        setSelNode(null);
        setSelEdge(null);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  function deleteNode(id: string) {
    onChange({ ...graph, nodes: graph.nodes.filter((n) => n.id !== id), edges: graph.edges.filter((e) => e.from !== id && e.to !== id) });
    setSelNode(null);
  }
  function deleteEdge(i: number) {
    onChange({ ...graph, edges: graph.edges.filter((_, j) => j !== i) });
    setSelEdge(null);
  }

  function addNode(x: number, y: number) {
    if (selNode || selEdge !== null) {
      setSelNode(null);
      setSelEdge(null);
      return;
    }
    const clamp = (v: number) => Math.round(Math.max(0, Math.min(10, v)) * 4) / 4;
    onChange({ ...graph, nodes: [...graph.nodes, { id: nextId(graph), x: clamp(x), y: clamp(y) }] });
  }

  function nodeDown(id: string, e: React.PointerEvent) {
    e.stopPropagation();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    drag.current = { id, moved: false };
  }

  function move(x: number, y: number) {
    const d = drag.current;
    if (!d) return;
    d.moved = true;
    const g = graphRef.current;
    onChange({
      ...g,
      nodes: g.nodes.map((n) => (n.id === d.id ? { ...n, x: Math.max(0, Math.min(10, x)), y: Math.max(0, Math.min(10, y)) } : n)),
    });
  }

  function up() {
    const d = drag.current;
    drag.current = null;
    if (!d || d.moved) return;
    // click on a node: select / connect
    setSelEdge(null);
    if (selNode === null) setSelNode(d.id);
    else if (selNode === d.id) setSelNode(null);
    else {
      const exists = graph.edges.some(
        (e) => (e.from === selNode && e.to === d.id) || (!graph.directed && e.from === d.id && e.to === selNode),
      );
      if (!exists) {
        onChange({ ...graph, edges: [...graph.edges, weighted ? { from: selNode, to: d.id, w: 1 } : { from: selNode, to: d.id }] });
        setSelEdge(graph.edges.length);
      }
      setSelNode(null);
    }
  }

  const edge = selEdge !== null ? graph.edges[selEdge] : null;

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
        {allowDirectedToggle && (
          <label className="inline-flex items-center gap-1.5">
            <input type="checkbox" checked={graph.directed} onChange={(e) => onChange({ ...graph, directed: e.target.checked })} />
            orientovaný
          </label>
        )}
        <Button variant="ghost" onClick={() => onChange({ ...graph, nodes: [], edges: [] })}>
          Vymazat vše
        </Button>
        {selNode && (
          <Button variant="ghost" className="text-bad" onClick={() => deleteNode(selNode)}>
            Smazat uzel {selNode}
          </Button>
        )}
      </div>
      <div className="rounded-lg border border-dashed border-line bg-surface">
        <GraphView
          graph={graph}
          fixedFrame
          showWeights={weighted}
          selectedNode={selNode}
          selectedEdge={selEdge}
          onBackgroundClick={addNode}
          onNodePointerDown={nodeDown}
          onPointerMove={move}
          onPointerUp={up}
          onEdgeClick={(i) => {
            setSelNode(null);
            setSelEdge(i === selEdge ? null : i);
          }}
          className="max-h-[60vh]"
          ariaLabel="Editor grafu"
        />
      </div>
      {edge && selEdge !== null ? (
        <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-surface-2 p-2 text-sm">
          <span className="font-medium">
            Hrana {edge.from}
            {graph.directed ? "→" : "–"}
            {edge.to}
          </span>
          {weighted && (
            <label className="inline-flex items-center gap-1">
              {weightLabel} =
              <input
                type="number"
                className="w-20 rounded border border-line bg-surface px-2 py-1"
                value={edge.w ?? 1}
                autoFocus
                onChange={(e) => {
                  const w = Number(e.target.value);
                  onChange({ ...graph, edges: graph.edges.map((x, j) => (j === selEdge ? { ...x, w } : x)) });
                }}
              />
            </label>
          )}
          <Button variant="ghost" className="text-bad" onClick={() => deleteEdge(selEdge)}>
            Smazat hranu
          </Button>
        </div>
      ) : (
        <p className="mt-2 text-xs text-muted">
          Klik do prázdna = nový uzel · klik na uzel a pak na další = nová hrana · tažení = přesun · klik na hranu = úprava{" "}
          {weighted ? `(${weightLabel})` : ""} · Delete = smazat výběr
        </p>
      )}
    </div>
  );
}
