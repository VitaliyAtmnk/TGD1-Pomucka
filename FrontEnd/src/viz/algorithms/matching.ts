import type { AlgorithmDef } from "../types";
import { adjacency, cmpId, Recorder, set, sortedIds } from "./common";
import { PRESETS } from "../presets";

/** 2-colours the graph; returns null if it is not bipartite. The side drawn more to the left is "left". */
function sides(g: Parameters<AlgorithmDef["run"]>[0]): { left: string[]; right: Set<string> } | null {
  const adj = adjacency(g);
  const color = new Map<string, number>();
  for (const s of sortedIds(g)) {
    if (color.has(s)) continue;
    color.set(s, 0);
    const q = [s];
    while (q.length) {
      const v = q.shift()!;
      for (const a of adj.get(v)!) {
        if (!color.has(a.to)) {
          color.set(a.to, 1 - color.get(v)!);
          q.push(a.to);
        } else if (color.get(a.to) === color.get(v)) return null;
      }
    }
  }
  // put the side whose nodes are more to the left on the left
  const xs = (c: number) => {
    const arr = g.nodes.filter((n) => color.get(n.id) === c);
    return arr.reduce((acc, n) => acc + n.x, 0) / Math.max(1, arr.length);
  };
  const leftColor = xs(0) <= xs(1) ? 0 : 1;
  return {
    left: sortedIds(g).filter((v) => color.get(v) === leftColor),
    right: new Set(sortedIds(g).filter((v) => color.get(v) !== leftColor)),
  };
}

export const bipartiteMatching: AlgorithmDef = {
  id: "bipartite-matching",
  title: "Maximální párování v bigrafu",
  short: "Párování",
  description:
    "Párování zvětšujeme po **střídavých cestách**: cesta z volného levého uzlu do volného pravého uzlu, jejíž hrany se střídají mimo/v párování. " +
    "Když hrany cesty prohodíme, párování vzroste o 1. Je to přesně Ford–Fulkerson v síti zdroj → levá strana → pravá strana → stok s jednotkovými propustnostmi " +
    "(střídavá cesta = rezervní polocesta). Velikost maximálního párování je **párovací číslo** a rovná se **generické hodnosti** strukturální matice (věta 3.6). " +
    "Složitost $O(n \\cdot m)$.",
  graphKind: "undirected",
  weighted: false,
  params: [],
  presets: [
    { name: "Bigraf matice ze skript (odd. 3.3)", graph: PRESETS.bigraph, params: {} },
    { name: "Bez perfektního párování", graph: PRESETS.bigraphDeficient, params: {} },
  ],
  pseudocode: [
    "M := ∅",
    "pro každý levý uzel u: hledej střídavou cestu z u do volného pravého uzlu (DFS)",
    "  nalezena → prohoď hrany na cestě (|M| vzroste o 1)",
    "  nenalezena → u zůstane nespárovaný",
    "|M| je párovací číslo; |M| = n ⇔ perfektní párování (generická regularita)",
  ],
  validate: (g) => (g.directed ? "Bigraf zadej jako neorientovaný graf (strany se určí automaticky)." : sides(g) === null ? "Graf není bipartitní (obsahuje lichou kružnici)." : null),
  run(g) {
    const { left, right } = sides(g)!;
    const adj = adjacency(g);
    const rec = new Recorder();
    const mate = new Map<string, { v: string; edge: number }>();
    left.forEach((v) => rec.node(v, { label: "L" }));
    right.forEach((v) => rec.node(v, { label: "P" }));
    rec.push(`Strany bigrafu: levá $${set(left)}$, pravá $${set([...right].sort(cmpId))}$. Začínáme s prázdným párováním.`, { line: 0 });
    const markMatching = () => {
      g.edges.forEach((_, i) => rec.edge(i, { state: "dim" }));
      for (const [, m] of mate) rec.edge(m.edge, { state: "tree" });
    };
    for (const u of left) {
      const seen = new Set<string>();
      const path: { from: string; to: string; edge: number }[] = [];
      const dfs = (x: string): boolean => {
        for (const a of adj.get(x)!) {
          if (seen.has(a.to)) continue;
          seen.add(a.to);
          path.push({ from: x, to: a.to, edge: a.edge });
          const m = mate.get(a.to);
          if (!m) return true;
          path.push({ from: a.to, to: m.v, edge: m.edge });
          if (dfs(m.v)) return true;
          path.pop();
          path.pop();
        }
        return false;
      };
      markMatching();
      rec.node(u, { state: "active" });
      if (dfs(u)) {
        path.forEach((s) => rec.edge(s.edge, { state: "path" }));
        path.forEach((s) => rec.node(s.to, { state: "frontier" }));
        rec.push(
          `Střídavá cesta z **${u}**: ${[u, ...path.map((s) => s.to)].join(" – ")}. ` +
            (path.length > 1 ? "Hrany v párování na ní vyměníme za hrany mimo párování." : "Volný soused – hranu přidáme."),
          { line: 2, info: [{ label: "|M|", value: String(mate.size / 2) }] },
        );
        for (let k = 0; k < path.length; k += 2) {
          const s = path[k];
          mate.set(s.to, { v: s.from, edge: s.edge });
          mate.set(s.from, { v: s.to, edge: s.edge });
        }
        markMatching();
        [...left, ...right].forEach((v) => rec.node(v, { state: mate.has(v) ? "done" : "default" }));
        rec.push(`Párování má nyní ${mate.size / 2} hran.`, { line: 2, info: [{ label: "|M|", value: String(mate.size / 2) }] });
      } else {
        rec.node(u, { state: "rejected" });
        rec.push(
          `Z uzlu **${u}** nevede žádná střídavá cesta do volného pravého uzlu → ${u} zůstane nespárovaný. ` +
            `Navštívené pravé uzly $${set([...seen].sort(cmpId))}$ mají sousedy jen mezi už spárovanými – Hallova podmínka je porušena.`,
          { line: 3, info: [{ label: "|M|", value: String(mate.size / 2) }] },
        );
      }
    }
    const size = mate.size / 2;
    const perfect = size === left.length && left.length === right.size;
    rec.push(
      `Maximální párování má **${size}** hran (párovací číslo). ` +
        (perfect
          ? "Je **perfektní** – strukturální matice je tedy genericky regulární."
          : `Perfektní párování neexistuje, generická hodnost odpovídající matice je ${size}.`),
      { line: 4 },
    );
    return rec.steps;
  },
};
