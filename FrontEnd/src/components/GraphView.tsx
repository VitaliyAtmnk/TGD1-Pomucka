import { useMemo, useRef, type PointerEvent as RPointerEvent } from "react";
import type { EdgeState, EdgeStyle, Graph, NodeState, NodeStyle } from "../viz/types";

const S = 60; // world unit -> svg px
const R0 = 17; // node radius at nodeScale = 1

// highlighter set, defined per theme in index.css; text on top of them is always var(--g-on-mark)
export const COLOR_CLASSES = ["var(--c0)", "var(--c1)", "var(--c2)", "var(--c3)", "var(--c4)", "var(--c5)", "var(--c6)", "var(--c7)"];

const NODE_FILL: Record<NodeState, string> = {
  default: "var(--g-node)",
  active: "var(--g-active)",
  frontier: "color-mix(in srgb, var(--g-active) 35%, var(--g-node))",
  visited: "var(--g-visited)",
  done: "var(--g-done)",
  source: "var(--g-tree)",
  sink: "var(--g-path)",
  rejected: "var(--g-rejected)",
  path: "var(--g-path)",
};
const NODE_TEXT: Partial<Record<NodeState, string>> = {
  active: "var(--g-on-mark)",
  done: "var(--g-done-text)",
  source: "var(--g-done-text)",
  sink: "var(--g-done-text)",
  path: "var(--g-done-text)",
};

const EDGE_COLOR: Record<EdgeState, string> = {
  default: "var(--g-edge)",
  active: "var(--g-active)",
  considered: "var(--g-active)",
  tree: "var(--g-tree)",
  rejected: "var(--g-rejected)",
  path: "var(--g-path)",
  cut: "var(--g-path)",
  back: "var(--g-visited)",
  dim: "var(--g-rejected)",
  hidden: "transparent",
};
const EDGE_WIDTH: Record<EdgeState, number> = {
  default: 1.8,
  active: 4,
  considered: 2.5,
  tree: 4,
  rejected: 1.5,
  path: 4.5,
  cut: 3,
  back: 2.2,
  dim: 1.2,
  hidden: 0,
};

export interface GraphViewProps {
  graph: Graph;
  nodeStyles?: Record<string, NodeStyle>;
  edgeStyles?: Record<number, EdgeStyle>;
  showWeights?: boolean;
  className?: string;
  /** fixed 0..10 frame (editor) instead of fitting the bounding box */
  fixedFrame?: boolean;
  selectedNode?: string | null;
  selectedEdge?: number | null;
  onBackgroundClick?: (x: number, y: number) => void;
  onNodePointerDown?: (id: string, e: RPointerEvent) => void;
  onEdgeClick?: (index: number) => void;
  onPointerMove?: (x: number, y: number) => void;
  onPointerUp?: () => void;
  ariaLabel?: string;
  /** enlarge nodes, labels and strokes (for small embeds such as illustrations) */
  nodeScale?: number;
}

export function GraphView({
  graph,
  nodeStyles = {},
  edgeStyles = {},
  showWeights = true,
  className = "",
  fixedFrame = false,
  selectedNode,
  selectedEdge,
  onBackgroundClick,
  onNodePointerDown,
  onEdgeClick,
  onPointerMove,
  onPointerUp,
  ariaLabel = "Graf",
  nodeScale = 1,
}: GraphViewProps) {
  const R = R0 * nodeScale;
  const F = nodeScale;
  const svgRef = useRef<SVGSVGElement>(null);
  const pos = useMemo(() => new Map(graph.nodes.map((n) => [n.id, n])), [graph.nodes]);

  const viewBox = useMemo(() => {
    const pad = 0.9;
    if (fixedFrame || graph.nodes.length === 0) return [-pad * S, -pad * S, (10 + 2 * pad) * S, (10 + 2 * pad) * S];
    const xs = graph.nodes.map((n) => n.x);
    const ys = graph.nodes.map((n) => n.y);
    let [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    if (x1 - x0 < 3) [x0, x1] = [x0 - 1.5, x1 + 1.5];
    if (y1 - y0 < 2) [y0, y1] = [y0 - 1, y1 + 1];
    return [(x0 - pad) * S, (y0 - pad) * S, (x1 - x0 + 2 * pad) * S, (y1 - y0 + 2 * pad) * S];
  }, [graph.nodes, fixedFrame]);

  const pairSet = useMemo(() => new Set(graph.edges.map((e) => `${e.from}->${e.to}`)), [graph.edges]);

  function toWorld(clientX: number, clientY: number) {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const p = pt.matrixTransform(svg.getScreenCTM()!.inverse());
    return { x: p.x / S, y: p.y / S };
  }

  const interactive = !!(onBackgroundClick || onNodePointerDown || onEdgeClick);

  return (
    <svg
      ref={svgRef}
      viewBox={viewBox.join(" ")}
      className={`w-full select-none ${className}`}
      role="img"
      aria-label={ariaLabel}
      style={{ touchAction: interactive ? "none" : undefined }}
      onPointerMove={onPointerMove ? (e) => onPointerMove(...(Object.values(toWorld(e.clientX, e.clientY)) as [number, number])) : undefined}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
      onClick={
        onBackgroundClick
          ? (e) => {
              if (e.target === svgRef.current || (e.target as Element).getAttribute("data-bg")) {
                const p = toWorld(e.clientX, e.clientY);
                onBackgroundClick(p.x, p.y);
              }
            }
          : undefined
      }
    >
      <defs>
        {(Object.keys(EDGE_COLOR) as EdgeState[]).map((st) => (
          <marker
            key={st}
            id={`arrow-${st}`}
            viewBox="0 0 10 10"
            refX="10"
            refY="5"
            markerWidth="12"
            markerHeight="12"
            markerUnits="userSpaceOnUse"
            orient="auto-start-reverse"
          >
            <path d="M0,0 L10,5 L0,10 z" fill={EDGE_COLOR[st]} />
          </marker>
        ))}
      </defs>
      {interactive && <rect data-bg="1" x={viewBox[0]} y={viewBox[1]} width={viewBox[2]} height={viewBox[3]} fill="transparent" />}

      {graph.edges.map((e, i) => {
        const a = pos.get(e.from);
        const b = pos.get(e.to);
        if (!a || !b) return null;
        const st = edgeStyles[i]?.state ?? "default";
        if (st === "hidden") return null;
        const color = st === "default" && e.color !== undefined ? COLOR_CLASSES[e.color % COLOR_CLASSES.length] : EDGE_COLOR[st];
        const width = EDGE_WIDTH[st] + (selectedEdge === i ? 2 : 0) + (st === "default" && e.color !== undefined ? 1.5 : 0);
        const [ax, ay, bx, by] = [a.x * S, a.y * S, b.x * S, b.y * S];
        const dx = bx - ax;
        const dy = by - ay;
        const len = Math.hypot(dx, dy) || 1;
        const [ux, uy] = [dx / len, dy / len];
        const [nx, ny] = [-uy, ux];
        const curved = graph.directed && pairSet.has(`${e.to}->${e.from}`) && e.from !== e.to;
        const bend = curved ? 22 : 0;
        // control point
        const cx = (ax + bx) / 2 + nx * bend * 2;
        const cy = (ay + by) / 2 + ny * bend * 2;
        // shorten to node border
        const startDir = curved ? norm(cx - ax, cy - ay) : [ux, uy];
        const endDir = curved ? norm(bx - cx, by - cy) : [ux, uy];
        const sx = ax + startDir[0] * R;
        const sy = ay + startDir[1] * R;
        const tx = bx - endDir[0] * (R + (graph.directed ? 3 : 0));
        const ty = by - endDir[1] * (R + (graph.directed ? 3 : 0));
        const d = curved ? `M${sx},${sy} Q${cx},${cy} ${tx},${ty}` : `M${sx},${sy} L${tx},${ty}`;
        const label = edgeStyles[i]?.label ?? e.label ?? (showWeights && e.w !== undefined ? fmtW(e.w) : undefined);
        const lx = curved ? (ax + 2 * cx + bx) / 4 + nx * 12 : (ax + bx) / 2 + nx * 13;
        const ly = curved ? (ay + 2 * cy + by) / 4 + ny * 12 : (ay + by) / 2 + ny * 13;
        return (
          <g key={i} onClick={onEdgeClick ? () => onEdgeClick(i) : undefined} className={onEdgeClick ? "cursor-pointer" : ""}>
            {onEdgeClick && <path d={d} stroke="transparent" strokeWidth={16} fill="none" />}
            <path
              d={d}
              stroke={color}
              strokeWidth={width * (0.6 + 0.4 * F)}
              fill="none"
              strokeDasharray={st === "back" || st === "cut" ? "7 5" : undefined}
              markerEnd={graph.directed ? `url(#arrow-${st})` : undefined}
              style={{ transition: "stroke 0.25s, stroke-width 0.25s" }}
            />
            {label !== undefined && (
              <text
                x={lx}
                y={ly}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={15 * F}
                fontWeight={600}
                fill={st === "default" || st === "dim" || st === "rejected" ? "var(--muted)" : color}
                stroke="var(--surface)"
                strokeWidth={5}
                paintOrder="stroke"
              >
                {label}
              </text>
            )}
          </g>
        );
      })}

      {graph.nodes.map((n) => {
        const ns = nodeStyles[n.id] ?? {};
        const st = ns.state ?? "default";
        const colorClass = ns.color ?? (st === "default" ? n.color : undefined);
        const fill = colorClass !== undefined ? COLOR_CLASSES[colorClass % COLOR_CLASSES.length] : NODE_FILL[st];
        const textColor = colorClass !== undefined ? "var(--g-on-mark)" : (NODE_TEXT[st] ?? "var(--ink)");
        const text = n.label ?? n.id;
        const selected = selectedNode === n.id;
        return (
          <g
            key={n.id}
            transform={`translate(${n.x * S},${n.y * S})`}
            onPointerDown={onNodePointerDown ? (e) => onNodePointerDown(n.id, e) : undefined}
            className={onNodePointerDown ? "cursor-grab" : ""}
          >
            {selected && <circle r={R + 6} fill="none" stroke="var(--accent)" strokeWidth={3} strokeDasharray="4 3" />}
            <circle
              r={R}
              fill={fill}
              stroke={st === "rejected" ? "var(--g-edge)" : "var(--g-node-stroke)"}
              strokeWidth={st === "active" ? 3 : 1.8}
              style={{ transition: "fill 0.25s" }}
            />
            <text
              textAnchor="middle"
              dominantBaseline="central"
              fontSize={(text.length > 3 ? 11 : 15) * F}
              fontWeight={600}
              fill={textColor}
              fontFamily="var(--font-mono)"
            >
              {text}
            </text>
            {ns.label !== undefined && (
              <text
                y={R + 15 * F}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={14 * F}
                fontWeight={700}
                fill="var(--accent)"
                stroke="var(--surface)"
                strokeWidth={5}
                paintOrder="stroke"
              >
                {ns.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function norm(x: number, y: number): [number, number] {
  const l = Math.hypot(x, y) || 1;
  return [x / l, y / l];
}

function fmtW(w: number) {
  return Number.isInteger(w) ? String(w) : w.toFixed(1);
}
