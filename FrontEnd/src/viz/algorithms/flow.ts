import type { AlgorithmDef } from "../types";
import { Recorder, resolveNode, set, sortedIds } from "./common";
import { PRESETS } from "../presets";

interface Move {
  edge: number;
  forward: boolean; // souhlasná (true) / nesouhlasná (false) hrana polocesty
  from: string;
  to: string;
}

export const maxFlow: AlgorithmDef = {
  id: "max-flow",
  title: "Maximální tok (Ford–Fulkerson, Edmonds–Karp)",
  short: "Maximální tok",
  description:
    "Začneme nulovým tokem a opakovaně hledáme **rezervní polocestu** ze zdroje $z$ do stoku $s$: po souhlasných hranách lze tok zvýšit o $r_{ij} - x_{ij}$, " +
    "po nesouhlasných snížit o $x_{ij}$. Tok podél ní zvětšíme o rezervu $\\Theta$. Když už žádná rezervní polocesta neexistuje, množina $R$ uzlů dosažitelných ze zdroje " +
    "určuje **minimální řez** $(R, \\bar R)$ a podle Ford–Fulkersonovy věty je tok maximální. " +
    "**Edmonds–Karp** volí vždy nejkratší polocestu (BFS) a skončí po $O(m n)$ zlepšeních nezávisle na propustnostech. Popisky hran: $x_{ij}/r_{ij}$.",
  graphKind: "directed",
  weighted: true,
  weightLabel: "r",
  params: [
    { key: "source", label: "Zdroj z", type: "node", default: "first" },
    { key: "sink", label: "Stok s", type: "node", default: "last" },
    {
      key: "mode",
      label: "Výběr polocesty",
      type: "select",
      options: [
        { value: "bfs", label: "Nejkratší – BFS (Edmonds–Karp)" },
        { value: "dfs", label: "Libovolná – DFS (Ford–Fulkerson)" },
      ],
      default: "bfs",
    },
  ],
  presets: [
    { name: "Příklad ze skript (odd. 2.4)", graph: PRESETS.flow, params: { source: "z", sink: "s", mode: "bfs" } },
    { name: "Proč nestačí orientované cesty", graph: PRESETS.flowNaive, params: { source: "z", sink: "s", mode: "dfs" } },
    { name: "Nešťastná volba polocest (2Q kroků)", graph: PRESETS.flowQ, params: { source: "z", sink: "s", mode: "dfs" } },
  ],
  pseudocode: [
    "x := 0 (nulový tok)",
    "dokud existuje rezervní polocesta P ze z do s:",
    "  Θ := min( r − x na souhlasných hranách, x na nesouhlasných )",
    "  souhlasné hrany: x += Θ, nesouhlasné: x −= Θ",
    "R := uzly dosažitelné ze z po rezervních polocestách",
    "x je maximální, (R, R̄) je minimální řez, |x| = r(R, R̄)",
  ],
  validate: (g, p) => {
    if (!g.directed) return "Síť musí být orientovaný graf.";
    const s = resolveNode(g, p.source, "first");
    const t = resolveNode(g, p.sink, "last");
    if (s === t) return "Zdroj a stok musí být různé uzly.";
    if (g.edges.some((e) => (e.w ?? 0) <= 0)) return "Propustnosti hran musí být kladné.";
    return null;
  },
  run(g, params) {
    const z = resolveNode(g, params.source, "first");
    const s = resolveNode(g, params.sink, "last");
    const dfs = params.mode === "dfs";
    const x = g.edges.map(() => 0);
    const r = g.edges.map((e) => e.w ?? 1);
    const ids = sortedIds(g);
    const rec = new Recorder();
    let value = 0;
    const labelAll = () => g.edges.forEach((_, i) => rec.edge(i, { label: `${x[i]}/${r[i]}`, state: x[i] === r[i] ? "considered" : x[i] > 0 ? "back" : "default" }));
    const resetNodes = () => ids.forEach((v) => rec.node(v, { state: v === z ? "source" : v === s ? "sink" : "default", label: undefined }));

    // moves from node v along semi-path edges with positive reserve
    const moves = (v: string): Move[] => {
      const out: Move[] = [];
      g.edges.forEach((e, i) => {
        if (e.from === v && x[i] < r[i]) out.push({ edge: i, forward: true, from: v, to: e.to });
        if (e.to === v && x[i] > 0) out.push({ edge: i, forward: false, from: v, to: e.from });
      });
      return out.sort((a, b) => a.to.localeCompare(b.to, "cs", { numeric: true }));
    };

    const reachable = () => {
      const prev = new Map<string, Move | null>([[z, null]]);
      const container = [z];
      while (container.length) {
        const v = dfs ? container.pop()! : container.shift()!;
        for (const m of moves(v)) {
          if (prev.has(m.to)) continue;
          prev.set(m.to, m);
          if (m.to === s && !dfs) return prev;
          container.push(m.to);
        }
        if (dfs && prev.has(s)) return prev;
      }
      return prev;
    };

    resetNodes();
    labelAll();
    rec.push(`Začínáme s nulovým tokem. Zdroj **${z}**, stok **${s}**. Popisky hran jsou $x_{ij}/r_{ij}$.`, { line: 0, info: [{ label: "|x|", value: "0" }] });

    for (let iter = 1; iter <= 500; iter++) {
      const prev = reachable();
      if (!prev.has(s)) {
        const R = [...prev.keys()];
        resetNodes();
        R.forEach((v) => rec.node(v, { state: v === z ? "source" : "visited" }));
        labelAll();
        const cut: number[] = [];
        g.edges.forEach((e, i) => {
          if (prev.has(e.from) && !prev.has(e.to)) {
            cut.push(i);
            rec.edge(i, { state: "cut" });
          } else if (!prev.has(e.from) && prev.has(e.to)) rec.edge(i, { state: "dim" });
        });
        const cap = cut.reduce((acc, i) => acc + r[i], 0);
        rec.push(
          `Rezervní polocesta do **${s}** už neexistuje. Uzly dosažitelné ze zdroje: $R = ${set(R.sort((a, b) => a.localeCompare(b, "cs", { numeric: true })))}$ (modře). ` +
            `Hrany z $R$ do $\\bar R$ jsou nasycené, hrany z $\\bar R$ do $R$ nulové.`,
          { line: 4, info: [{ label: "|x|", value: String(value) }] },
        );
        rec.push(
          `Řez $(R, \\bar R) = \\{${cut.map((i) => `(${g.edges[i].from},${g.edges[i].to})`).join(", ")}\\}$ má propustnost **${cap}** = $|x|$ = **${value}**. ` +
            "Podle tvrzení 2.2 (ii) nemůže být žádný tok větší → tok je **maximální** a řez **minimální**.",
          { line: 5, info: [{ label: "|x|", value: String(value) }, { label: "r(R, R̄)", value: String(cap) }] },
        );
        return rec.steps;
      }
      // reconstruct semi-path
      const path: Move[] = [];
      for (let v = s; v !== z; ) {
        const m = prev.get(v)!;
        path.unshift(m);
        v = m.from;
      }
      const reserves = path.map((m) => (m.forward ? r[m.edge] - x[m.edge] : x[m.edge]));
      const theta = Math.min(...reserves);
      resetNodes();
      labelAll();
      path.forEach((m) => {
        rec.edge(m.edge, { state: "path" });
        rec.node(m.to, { state: m.to === s ? "sink" : "active" });
      });
      const desc = path
        .map((m, k) => `${m.from}→${m.to}${m.forward ? "" : " (nesouhlasná)"}: ${reserves[k]}`)
        .join(", ");
      const nodesSeq = [z, ...path.map((m) => m.to)].join("");
      rec.push(
        `Iterace ${iter}: rezervní polocesta **${nodesSeq}**${path.some((m) => !m.forward) ? " – obsahuje nesouhlasnou hranu, tok po ní **vrátíme**" : ""}. ` +
          `Rezervy: ${desc}. $\\Theta = ${theta}$.`,
        { line: 2, info: [{ label: "|x|", value: String(value) }, { label: "Θ", value: String(theta) }] },
      );
      path.forEach((m) => (x[m.edge] += m.forward ? theta : -theta));
      value += theta;
      labelAll();
      path.forEach((m) => rec.edge(m.edge, { state: "path" }));
      rec.push(`Upravíme tok podél polocesty o $\\Theta = ${theta}$. Nová velikost toku $|x| = ${value}$.`, {
        line: 3,
        info: [{ label: "|x|", value: String(value) }],
      });
    }
    rec.push("Příliš mnoho iterací – zastaveno.");
    return rec.steps;
  },
  relatedItems: ["alg-ford-fulkerson", "thm-ford-fulkerson", "alg-edmonds-karp"],
};
