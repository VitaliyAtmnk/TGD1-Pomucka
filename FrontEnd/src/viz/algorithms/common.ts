import type { EdgeStyle, Graph, NodeStyle, Step } from "../types";

export interface Arc {
  to: string;
  w: number;
  edge: number; // index in graph.edges
  forward: boolean; // false = traversing an undirected edge "backwards" (to -> from)
}

/** Adjacency lists. Undirected edges appear in both directions. */
export function adjacency(g: Graph, reverse = false): Map<string, Arc[]> {
  const adj = new Map<string, Arc[]>(g.nodes.map((n) => [n.id, []]));
  g.edges.forEach((e, i) => {
    const w = e.w ?? 1;
    const [a, b] = reverse ? [e.to, e.from] : [e.from, e.to];
    adj.get(a)?.push({ to: b, w, edge: i, forward: true });
    if (!g.directed && a !== b) adj.get(b)?.push({ to: a, w, edge: i, forward: false });
  });
  for (const list of adj.values()) list.sort((x, y) => cmpId(x.to, y.to));
  return adj;
}

/** Natural ordering of node ids (numbers numerically, then strings). */
export function cmpId(a: string, b: string) {
  const na = Number(a);
  const nb = Number(b);
  if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
  return a.localeCompare(b, "cs");
}

export function sortedIds(g: Graph) {
  return g.nodes.map((n) => n.id).sort(cmpId);
}

export function resolveNode(g: Graph, value: string | undefined, fallback: "first" | "last" = "first") {
  const ids = sortedIds(g);
  if (value && ids.includes(value)) return value;
  return fallback === "first" ? ids[0] : ids[ids.length - 1];
}

/** Helper accumulating immutable snapshots. */
export class Recorder {
  steps: Step[] = [];
  nodes: Record<string, NodeStyle> = {};
  edges: Record<number, EdgeStyle> = {};

  node(id: string, style: NodeStyle) {
    this.nodes[id] = { ...this.nodes[id], ...style };
    return this;
  }
  edge(i: number, style: EdgeStyle) {
    this.edges[i] = { ...this.edges[i], ...style };
    return this;
  }
  push(message: string, extra: Omit<Step, "message" | "nodes" | "edges"> = {}) {
    this.steps.push({
      message,
      nodes: structuredClone(this.nodes),
      edges: structuredClone(this.edges),
      ...extra,
    });
  }
}

export const INF = Number.POSITIVE_INFINITY;
export const fmt = (x: number) => (x === INF ? "∞" : x === -INF ? "−∞" : Number.isInteger(x) ? String(x) : x.toFixed(2));
export const tex = (x: number) => (x === INF ? "\\infty" : fmt(x));
export const set = (xs: Iterable<string>) => `\\{${[...xs].join(", ")}\\}`;

export function isAcyclic(g: Graph): boolean {
  return topoOrder(g) !== null;
}

export function topoOrder(g: Graph): string[] | null {
  const indeg = new Map(g.nodes.map((n) => [n.id, 0]));
  g.edges.forEach((e) => indeg.set(e.to, (indeg.get(e.to) ?? 0) + 1));
  const adj = adjacency(g);
  const queue = sortedIds(g).filter((v) => indeg.get(v) === 0);
  const order: string[] = [];
  while (queue.length) {
    const v = queue.shift()!;
    order.push(v);
    for (const a of adj.get(v)!) {
      indeg.set(a.to, indeg.get(a.to)! - 1);
      if (indeg.get(a.to) === 0) queue.push(a.to);
    }
  }
  return order.length === g.nodes.length ? order : null;
}

/** Strongly connected components; returned in a topological order of the condensation. */
export function strongComponents(g: Graph): { comps: string[][]; compOf: Map<string, number> } {
  const adj = adjacency(g);
  const radj = adjacency(g, true);
  const seen = new Set<string>();
  const finish: string[] = [];
  const dfs = (v: string) => {
    seen.add(v);
    for (const a of adj.get(v)!) if (!seen.has(a.to)) dfs(a.to);
    finish.push(v);
  };
  for (const v of sortedIds(g)) if (!seen.has(v)) dfs(v);
  const compOf = new Map<string, number>();
  const comps: string[][] = [];
  for (const s of [...finish].reverse()) {
    if (compOf.has(s)) continue;
    const c = comps.length;
    const members: string[] = [];
    const stack = [s];
    compOf.set(s, c);
    while (stack.length) {
      const v = stack.pop()!;
      members.push(v);
      for (const a of radj.get(v)!)
        if (!compOf.has(a.to)) {
          compOf.set(a.to, c);
          stack.push(a.to);
        }
    }
    comps.push(members.sort(cmpId));
  }
  return { comps, compOf };
}

// ------------------------------------------------------------ CNF formulas

export interface Literal {
  v: string; // variable name, e.g. "x1"
  neg: boolean;
}
export type Clause = Literal[];

/**
 * Parses formulas like "(x1 ∨ ¬x2) ∧ (¬x1 ∨ x3)". Accepted operators: ∨ v | + , for OR;
 * ¬ ! ~ - or a trailing ' for negation; clauses must be in parentheses.
 */
export function parseCnf(text: string): { clauses: Clause[]; vars: string[] } | { error: string } {
  const groups = [...text.matchAll(/\(([^()]*)\)/g)].map((m) => m[1]);
  if (groups.length === 0) return { error: "Zapiš formuli v KNF s klauzulemi v závorkách, např. (x1 ∨ ¬x2) ∧ (x2 ∨ x3)." };
  const vars = new Set<string>();
  const clauses: Clause[] = [];
  for (const gtext of groups) {
    const parts = gtext.split(/∨|\||\+|,|\s+v\s+|\bor\b/i).map((s) => s.trim()).filter(Boolean);
    if (parts.length === 0) return { error: "Prázdná klauzule ()." };
    const clause: Clause = [];
    for (const p of parts) {
      const m = p.match(/^([¬!~\-]*)\s*([a-zA-Z][a-zA-Z0-9_]*)\s*('?)$/);
      if (!m) return { error: `Nerozumím literálu „${p}“.` };
      const neg = (m[1].length + (m[3] ? 1 : 0)) % 2 === 1;
      clause.push({ v: m[2], neg });
      vars.add(m[2]);
    }
    clauses.push(clause);
  }
  return { clauses, vars: [...vars].sort(cmpId) };
}

export const litName = (l: Literal) => (l.neg ? `¬${l.v}` : l.v);
export const litTex = (l: Literal) => {
  const m = l.v.match(/^([a-zA-Z]+)(\d+)$/);
  const base = m ? `${m[1]}_{${m[2]}}` : l.v;
  return l.neg ? `\\overline{${base}}` : base;
};
export const clauseTex = (c: Clause) => `(${c.map(litTex).join(" \\vee ")})`;
export const formulaTex = (cs: Clause[]) => cs.map(clauseTex).join(" \\wedge ");
