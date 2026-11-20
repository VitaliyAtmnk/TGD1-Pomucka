import type { GraphData } from "../api/types";

export interface GNode {
  id: string;
  x: number;
  y: number;
  label?: string; // display text (defaults to id)
  color?: number; // static colour class from content examples
}
export interface GEdge {
  from: string;
  to: string;
  w?: number;
  label?: string; // static text label (e.g. "∞", or "x/r" for flows in examples)
  color?: number; // static colour class (edge colourings in examples)
}
export interface Graph {
  directed: boolean;
  nodes: GNode[];
  edges: GEdge[];
}

export type NodeState = "default" | "active" | "frontier" | "visited" | "done" | "source" | "sink" | "rejected" | "path";
export type EdgeState = "default" | "active" | "considered" | "tree" | "rejected" | "path" | "cut" | "back" | "dim" | "hidden";

export interface NodeStyle {
  state?: NodeState;
  label?: string; // small label under the node (distance, number…)
  color?: number; // colour class (graph colouring / components)
}
export interface EdgeStyle {
  state?: EdgeState;
  label?: string; // overrides weight label, e.g. "2/5" for flow
}

export interface StepTable {
  title?: string;
  columns: string[];
  rowHeaders?: string[];
  rows: string[][];
  highlight?: [number, number][];
  dim?: [number, number][];
}

export interface Step {
  message: string; // Markdown + KaTeX
  nodes?: Record<string, NodeStyle>;
  edges?: Record<number, EdgeStyle>; // key = edge index in graph.edges
  tables?: StepTable[];
  info?: { label: string; value: string }[];
  line?: number; // highlighted pseudocode line (0-based)
}

export interface ParamDef {
  key: string;
  label: string;
  type: "node" | "select" | "text";
  options?: { value: string; label: string }[];
  placeholder?: string; // text params
  help?: string; // text params: format hint
  default?: string; // for node params: "first" | "last" | explicit id
}

export interface Preset {
  name: string;
  graph: Graph;
  params?: Record<string, string>;
}

export interface AlgorithmDef {
  id: string;
  title: string;
  short: string;
  description: string; // Markdown
  graphKind: "directed" | "undirected" | "any";
  weighted: boolean;
  weightLabel?: string;
  params: ParamDef[];
  presets: Preset[];
  pseudocode: string[] | ((params: Record<string, string>) => string[]);
  run: (g: Graph, params: Record<string, string>) => Step[];
  /** Graph that is actually drawn (e.g. built from a formula or extended by added edges). Defaults to the input graph. */
  displayGraph?: (g: Graph, params: Record<string, string>) => Graph;
  /** false = the input is given by parameters only (no graph editor / random graph). */
  editable?: boolean;
  validate?: (g: Graph, params: Record<string, string>) => string | null;
  relatedItems?: string[];
}

/** Convert content/API graph data to the internal representation (with layout). */
export function toGraph(data: GraphData, forceDirected?: boolean): Graph {
  const n = data.nodes.length;
  const hasPos = data.nodes.every((v) => typeof v.x === "number" && typeof v.y === "number");
  const nodes = data.nodes.map((v, i) => ({
    id: String(v.id),
    x: hasPos ? (v.x as number) : 5 + 4 * Math.cos((2 * Math.PI * i) / n - Math.PI / 2),
    y: hasPos ? (v.y as number) : 5 + 4 * Math.sin((2 * Math.PI * i) / n - Math.PI / 2),
    ...(typeof v.label === "string" || typeof v.label === "number" ? { label: String(v.label) } : {}),
    ...(typeof v.color === "number" ? { color: v.color } : {}),
  }));
  const edges = data.edges.map((e) => {
    const w = typeof e.w === "number" ? e.w : undefined;
    let label: string | undefined;
    if (typeof e.w === "string") label = e.w;
    else if (typeof e.x === "number" && w !== undefined) label = `${e.x}/${w}`;
    else if (typeof e.label === "string") label = e.label;
    return { from: String(e.from), to: String(e.to), w, label, ...(typeof e.color === "number" ? { color: e.color } : {}) };
  });
  return { directed: forceDirected ?? !!data.directed, nodes, edges };
}

export function edgeKey(e: GEdge, directed: boolean) {
  return directed || e.from < e.to ? `${e.from}->${e.to}` : `${e.to}->${e.from}`;
}
