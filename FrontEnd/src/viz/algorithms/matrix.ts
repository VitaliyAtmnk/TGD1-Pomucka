import type { AlgorithmDef, Graph, StepTable } from "../types";
import { Recorder, set, strongComponents } from "./common";

const EMPTY: Graph = { directed: true, nodes: [], edges: [] };
// Example from the lecture notes (section 3.2)
const DEFAULT_MATRIX = "0 1 0 2 3 0; 0 0 0 0 0 4; 0 5 6 0 0 0; 7 0 0 0 8 0; 9 10 0 0 11 12; 0 13 0 0 0 14";

function parseMatrix(text: string): number[][] | { error: string } {
  const rows = text
    .split(/;|\n/)
    .map((r) => r.trim())
    .filter(Boolean)
    .map((r) => r.split(/[\s,]+/).map(Number));
  if (!rows.length) return { error: "Zadej matici po řádcích oddělených středníkem, např. 0 1; 1 0." };
  const n = rows.length;
  if (rows.some((r) => r.length !== n)) return { error: `Matice musí být čtvercová (${n} řádků, ale některý řádek má jiný počet prvků).` };
  if (rows.some((r) => r.some((v) => Number.isNaN(v)))) return { error: "Prvky matice musí být čísla." };
  if (n > 9) return { error: "Nejvýše 9 × 9." };
  return rows;
}

function diagram(m: number[][]): Graph {
  const n = m.length;
  const nodes = m.map((_, i) => ({
    id: String(i + 1),
    x: 5 + 4.2 * Math.cos((2 * Math.PI * i) / n - Math.PI / 2),
    y: 5 + 4.2 * Math.sin((2 * Math.PI * i) / n - Math.PI / 2),
  }));
  const edges: Graph["edges"] = [];
  m.forEach((row, i) => row.forEach((v, j) => i !== j && v !== 0 && edges.push({ from: String(i + 1), to: String(j + 1) })));
  return { directed: true, nodes, edges };
}

const fmtCell = (v: number) => String(v);

export const matrixReducibility: AlgorithmDef = {
  id: "matrix-reducibility",
  title: "Rozložitelnost matice",
  short: "Rozložitelnost",
  description:
    "Čtvercová matice je **rozložitelná**, jde-li simultánní permutací řádků a sloupců převést do blokového tvaru s nulovým blokem vlevo dole. " +
    "Simultánní permutace = přečíslování uzlů **diagramu** $\\vec G(\\mathbf A)$ (hrana $i \\to j$, je-li $a_{ij} \\ne 0$). " +
    "Podle věty 3.2 je matice nerozložitelná, právě když je diagram silně souvislý; jinak očíslujeme uzly po **kvazikomponentách** v pořadí kondenzace " +
    "a dostaneme horní blokově trojúhelníkový tvar s nerozložitelnými diagonálními bloky. Místo $n!$ permutací stačí $O(n^2)$.",
  graphKind: "directed",
  weighted: false,
  editable: false,
  params: [
    {
      key: "matrix",
      label: "Matice A",
      type: "text",
      default: DEFAULT_MATRIX,
      placeholder: DEFAULT_MATRIX,
      help: "Řádky oddělené středníkem, prvky mezerou.",
    },
  ],
  presets: [
    { name: "Příklad ze skript (6 × 6)", graph: EMPTY, params: { matrix: DEFAULT_MATRIX } },
    { name: "Cyklus – nerozložitelná", graph: EMPTY, params: { matrix: "0 0 1 0; 0 0 0 3; 0 2 0 0; 4 0 0 0" } },
    { name: "Rozložitelná 4 × 4 (skripta)", graph: EMPTY, params: { matrix: "3 10 4 8; 0 1 0 6; 2 5 2 1; 0 3 0 1" } },
  ],
  pseudocode: [
    "Sestroj diagram: uzly 1…n, hrana i → j pro a_ij ≠ 0 (i ≠ j)",
    "Najdi kvazikomponenty diagramu",
    "Jediná kvazikomponenta → A je nerozložitelná",
    "Jinak seřaď kvazikomponenty podle kondenzace (hrany jen dopředu)",
    "Přečísluj uzly v tomto pořadí → PAPᵀ je horní blokově trojúhelníková",
  ],
  validate: (_g, p) => {
    const r = parseMatrix(p.matrix ?? "");
    return "error" in r ? r.error : null;
  },
  displayGraph: (_g, p) => {
    const r = parseMatrix(p.matrix ?? "");
    return "error" in r ? EMPTY : diagram(r);
  },
  run(_g, p) {
    const m = parseMatrix(p.matrix ?? "");
    if ("error" in m) return [];
    const n = m.length;
    const g = diagram(m);
    const labels = m.map((_, i) => String(i + 1));
    const rec = new Recorder();
    const original: StepTable = { title: "A", columns: labels, rowHeaders: labels, rows: m.map((r) => r.map(fmtCell)) };
    g.edges.forEach((_, i) => rec.edge(i, { state: "hidden" }));
    rec.push(`Matice $\\mathbf A$ řádu ${n}. Diagram má uzel pro každý řádek/sloupec.`, { line: 0, tables: [original] });
    m.forEach((row, i) => {
      const out = g.edges.map((e, k) => ({ e, k })).filter(({ e }) => e.from === String(i + 1));
      out.forEach(({ k }) => rec.edge(k, { state: "active" }));
      rec.node(String(i + 1), { state: "active" });
      rec.push(
        `Řádek ${i + 1}: nenulové prvky mimo diagonálu ve sloupcích ${row.map((v, j) => (v !== 0 && j !== i ? j + 1 : null)).filter(Boolean).join(", ") || "žádné"} → hrany z uzlu ${i + 1}.`,
        { line: 0, tables: [{ ...original, highlight: row.flatMap((v, j) => (v !== 0 && j !== i ? [[i, j] as [number, number]] : [])) }] },
      );
      out.forEach(({ k }) => rec.edge(k, { state: "default" }));
      rec.node(String(i + 1), { state: "default" });
    });
    const { comps, compOf } = strongComponents(g);
    comps.forEach((c, k) => c.forEach((v) => rec.node(v, { color: k })));
    rec.push(`Kvazikomponenty diagramu: ${comps.map((c) => `$${set(c)}$`).join(", ")}.`, { line: 1, tables: [original] });
    if (comps.length === 1) {
      rec.push("Diagram je **silně souvislý** → matice je **nerozložitelná** (důsledek 3.1).", { line: 2, tables: [original] });
      return rec.steps;
    }
    const order = comps.flat();
    const permuted: StepTable = {
      title: "PAPᵀ (přečíslováno po kvazikomponentách)",
      columns: order,
      rowHeaders: order,
      rows: order.map((i) => order.map((j) => fmtCell(m[Number(i) - 1][Number(j) - 1]))),
      highlight: order.flatMap((i, a) =>
        order.flatMap((j, b) => (compOf.get(i) === compOf.get(j) ? [[a, b] as [number, number]] : [])),
      ),
    };
    g.edges.forEach((e, i) => compOf.get(e.from) !== compOf.get(e.to) && rec.edge(i, { state: "considered" }));
    rec.push(
      `Hrany mezi kvazikomponentami (oranžově) vedou jen „dopředu“ v pořadí ${comps.map((c, k) => `$K_${k + 1} = ${set(c)}$`).join(", ")} – kondenzace je acyklická.`,
      { line: 3, tables: [original] },
    );
    rec.push(
      `Přečíslováním uzlů v pořadí ${order.join(", ")} dostaneme horní blokově trojúhelníkový tvar. Diagonální bloky (zvýrazněné) jsou nerozložitelné, pod nimi jsou nuly → matice je **rozložitelná**.`,
      { line: 4, tables: [permuted] },
    );
    return rec.steps;
  },
};
