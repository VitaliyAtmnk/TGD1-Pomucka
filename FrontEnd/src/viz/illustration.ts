/** Pure helpers for concept illustrations (shared by the component and the content checker). */
import type { IllustrationStep } from "../api/types";
import type { Graph } from "./types";

export interface Frame {
  graph: Graph;
  set: Set<string>;
  edgeSet: Set<number>;
  colors: Map<string, number>;
}

export function findEdge(g: Graph, a: string, b: string) {
  return g.edges.findIndex((e) => (e.from === a && e.to === b) || (!g.directed && e.from === b && e.to === a));
}

/** Edge index for a "from-to" key (node ids must not contain "-"). */
export function edgeByKey(g: Graph, key: string) {
  const i = key.indexOf("-");
  return i < 0 ? -1 : findEdge(g, key.slice(0, i), key.slice(i + 1));
}

/** Graph after applying add/remove of steps 0..k (cumulative). */
export function graphAt(base: Graph, steps: IllustrationStep[], k: number): Graph {
  let edges = [...base.edges];
  for (let i = 0; i <= k; i++) {
    for (const e of steps[i].add ?? []) edges.push({ from: String(e[0]), to: String(e[1]), w: typeof e[2] === "number" ? e[2] : undefined });
    for (const e of steps[i].remove ?? []) {
      const idx = findEdge({ ...base, edges }, String(e[0]), String(e[1]));
      if (idx >= 0) edges = edges.filter((_, j) => j !== idx);
    }
  }
  return { ...base, edges };
}

export function frameAt(base: Graph, steps: IllustrationStep[], k: number): Frame {
  const graph = graphAt(base, steps, k);
  const st = steps[k];
  return {
    graph,
    set: new Set((st.set ?? []).map(String)),
    edgeSet: new Set((st.edge_set ?? []).map((key) => edgeByKey(graph, key)).filter((i) => i >= 0)),
    colors: new Map(Object.entries(st.colors ?? {})),
  };
}
