import type { AlgorithmDef, StepTable } from "../types";
import { adjacency, fmt, INF, Recorder, resolveNode, sortedIds, tex, topoOrder } from "./common";
import { PRESETS } from "../presets";

// ------------------------------------------------------------------ Dijkstra

export const dijkstra: AlgorithmDef = {
  id: "dijkstra",
  title: "Dijkstrův algoritmus",
  short: "Dijkstra",
  description:
    "Hledá minimální $w$-cesty z jednoho uzlu do všech ostatních při **nezáporném** ohodnocení hran. " +
    "Udržuje dočasné odhady $d(v)$; v každém kroku prohlásí uzel s nejmenším odhadem za **definitivní** a z něj zkusí zlepšit (relaxovat) odhady sousedů. " +
    "Se seznamem uzlů má složitost $O(n^2)$, s haldou $O((n+m)\\log n)$.",
  graphKind: "any",
  weighted: true,
  weightLabel: "w",
  params: [{ key: "start", label: "Počáteční uzel", type: "node", default: "first" }],
  presets: [
    { name: "Neorientovaný graf", graph: PRESETS.weighted, params: { start: "1" } },
    { name: "Orientovaný graf (skripta 3.1)", graph: PRESETS.floyd, params: { start: "1" } },
  ],
  pseudocode: [
    "d(s) := 0, d(v) := ∞ pro v ≠ s; všechny uzly jsou dočasné",
    "dokud existuje dočasný uzel s d < ∞:",
    "  u := dočasný uzel s nejmenším d(u); u je definitivní",
    "  pro každou hranu uv do dočasného v:",
    "    je-li d(u) + w(uv) < d(v): d(v) := d(u) + w(uv), pred(v) := u",
  ],
  validate: (g) => (g.edges.some((e) => (e.w ?? 1) < 0) ? "Dijkstrův algoritmus vyžaduje nezáporné váhy." : null),
  run(g, params) {
    const s = resolveNode(g, params.start);
    const adj = adjacency(g);
    const d = new Map(g.nodes.map((n) => [n.id, INF]));
    const pred = new Map<string, { node: string; edge: number }>();
    const done = new Set<string>();
    const ids = sortedIds(g);
    const rec = new Recorder();
    d.set(s, 0);
    const table = (): StepTable => ({
      columns: ids,
      rowHeaders: ["d(v)", "pred"],
      rows: [ids.map((v) => fmt(d.get(v)!)), ids.map((v) => pred.get(v)?.node ?? "–")],
      highlight: ids.flatMap((v, j) => (done.has(v) ? [[0, j] as [number, number]] : [])),
    });
    for (const v of ids) rec.node(v, { label: fmt(d.get(v)!) });
    rec.node(s, { state: "frontier" });
    rec.push(`Inicializace: $d(${s}) = 0$, ostatní odhady jsou $\\infty$.`, { line: 0, tables: [table()] });
    for (;;) {
      let u: string | null = null;
      for (const v of ids) if (!done.has(v) && d.get(v)! < INF && (u === null || d.get(v)! < d.get(u)!)) u = v;
      if (u === null) break;
      done.add(u);
      rec.node(u, { state: "active" });
      if (pred.has(u)) rec.edge(pred.get(u)!.edge, { state: "tree" });
      rec.push(`Nejmenší dočasný odhad má uzel **${u}** ($d = ${tex(d.get(u)!)}$) → je **definitivní**.`, { line: 2, tables: [table()] });
      for (const a of adj.get(u)!) {
        if (done.has(a.to)) continue;
        const nd = d.get(u)! + a.w;
        if (nd < d.get(a.to)!) {
          const old = d.get(a.to)!;
          if (pred.has(a.to)) rec.edge(pred.get(a.to)!.edge, { state: "dim" });
          d.set(a.to, nd);
          pred.set(a.to, { node: u, edge: a.edge });
          rec.edge(a.edge, { state: "considered" }).node(a.to, { state: "frontier", label: fmt(nd) });
          rec.push(`Relaxace ${u}→${a.to}: $${tex(d.get(u)! )} + ${a.w} = ${nd} < ${tex(old)}$, zlepšíme $d(${a.to}) := ${nd}$.`, {
            line: 4,
            tables: [table()],
          });
        } else {
          rec.push(`Hrana ${u}→${a.to}: $${tex(d.get(u)!)} + ${a.w} = ${nd} \\ge ${tex(d.get(a.to)!)}$, odhad se nezlepší.`, {
            line: 4,
            tables: [table()],
          });
        }
      }
      rec.node(u, { state: "done" });
    }
    for (const [, p] of pred) rec.edge(p.edge, { state: "tree" });
    for (let i = 0; i < g.edges.length; i++) if (rec.edges[i]?.state !== "tree") rec.edge(i, { state: "dim" });
    rec.push("Hotovo. Zelené hrany tvoří **strom minimálních cest** z uzlu " + s + "; popisky uzlů jsou $w$-vzdálenosti.", {
      tables: [table()],
    });
    return rec.steps;
  },
  relatedItems: ["alg-dijkstra"],
};

// -------------------------------------------------------------------- Floyd

export const floyd: AlgorithmDef = {
  id: "floyd",
  title: "Floydův algoritmus",
  short: "Floyd",
  description:
    "Počítá celou **w-distanční matici** v čase $O(n^3)$. Matice $\\mathbf D_k$ obsahuje délky minimálních cest, " +
    "jejichž vnitřní uzly leží v množině $\\{1,\\dots,k\\}$: $d^k_{ij} = \\min\\{d^{k-1}_{ij},\\ d^{k-1}_{ik} + d^{k-1}_{kj}\\}$. " +
    "Zvýrazněná buňka se v daném kroku zlepšila díky průchodu přes uzel $k$.",
  graphKind: "any",
  weighted: true,
  weightLabel: "w",
  params: [],
  presets: [
    { name: "Příklad ze skript (odd. 3.1)", graph: PRESETS.floyd },
    { name: "Neorientovaný graf", graph: PRESETS.weighted },
  ],
  pseudocode: [
    "D₀: d_ii = 0, d_ij = w(ij) pro hranu ij, jinak ∞",
    "pro k = 1, …, n:",
    "  pro všechna i, j:",
    "    d_ij := min{ d_ij , d_ik + d_kj }",
    "Dₙ je w-distanční matice",
  ],
  run(g) {
    const ids = sortedIds(g);
    const n = ids.length;
    const idx = new Map(ids.map((v, i) => [v, i]));
    const D = ids.map((_, i) => ids.map((_, j) => (i === j ? 0 : INF)));
    g.edges.forEach((e) => {
      const i = idx.get(e.from)!;
      const j = idx.get(e.to)!;
      D[i][j] = Math.min(D[i][j], e.w ?? 1);
      if (!g.directed) D[j][i] = Math.min(D[j][i], e.w ?? 1);
    });
    const rec = new Recorder();
    const mat = (k: number, changed: [number, number][], kk?: number): StepTable => ({
      title: `D${sub(k)}`,
      columns: ids,
      rowHeaders: ids,
      rows: D.map((r) => r.map(fmt)),
      highlight: changed,
      dim:
        kk === undefined
          ? []
          : ids.flatMap((_, i) => ids.flatMap((_, j) => (i !== kk && j !== kk ? [] : [[i, j] as [number, number]]))),
    });
    rec.push("Počáteční matice $\\mathbf D_0$: na diagonále 0, pro hranu $ij$ její váha, jinak $\\infty$.", {
      line: 0,
      tables: [mat(0, [])],
    });
    for (let k = 0; k < n; k++) {
      const changed: [number, number][] = [];
      const via: string[] = [];
      for (let i = 0; i < n; i++)
        for (let j = 0; j < n; j++) {
          if (D[i][k] + D[k][j] < D[i][j]) {
            via.push(`$d_{${ids[i]}${ids[j]}}: ${tex(D[i][j])} \\to ${D[i][k] + D[k][j]}$`);
            changed.push([i, j]);
          }
        }
      // apply after collecting (row/column k never changes in step k, so this equals in-place update)
      for (const [i, j] of changed) D[i][j] = D[i][k] + D[k][j];
      for (const v of ids) rec.node(v, { state: v === ids[k] ? "active" : "default" });
      rec.push(
        `Krok $k = ${ids[k]}$: povolíme uzel **${ids[k]}** jako vnitřní uzel cest. ` +
          (via.length ? `Zlepšení: ${via.join(", ")}.` : "Žádná hodnota se nezlepšila."),
        { line: 3, tables: [mat(k + 1, changed, k)] },
      );
    }
    for (const v of ids) rec.node(v, { state: "default" });
    rec.push(`Hotovo: $\\mathbf D_${n} = \\mathbf D^w(${g.directed ? "\\vec G" : "G"})$. Celkem $n^3 = ${n ** 3}$ porovnání.`, {
      line: 4,
      tables: [mat(n, [])],
    });
    return rec.steps;
  },
  relatedItems: ["alg-floyd", "thm-floyd", "def-w-distancni-matice"],
};

function sub(k: number) {
  return String(k)
    .split("")
    .map((c) => "₀₁₂₃₄₅₆₇₈₉"[Number(c)])
    .join("");
}

// ------------------------------------------------------------ Critical path

export const criticalPath: AlgorithmDef = {
  id: "critical-path",
  title: "Kritická cesta v acyklickém grafu",
  short: "Kritická cesta",
  description:
    "V acyklickém grafu lze uzly očíslovat tak, aby hrany vedly jen od menších čísel k větším (**topologické uspořádání**). " +
    "Pak délky nejdelších (kritických) cest spočteme jedním průchodem: $t(v) = \\max_{(u,v)} \\{ t(u) + w(uv) \\}$. Složitost $O(n+m)$. " +
    "Kritická cesta určuje nejkratší možnou dobu dokončení projektu.",
  graphKind: "directed",
  weighted: true,
  weightLabel: "doba",
  params: [
    { key: "from", label: "Počátek", type: "node", default: "first" },
    { key: "to", label: "Cíl", type: "node", default: "last" },
  ],
  presets: [{ name: "Síťový graf projektu", graph: PRESETS.dag, params: { from: "1", to: "7" } }],
  pseudocode: [
    "Topologicky uspořádej uzly (opakovaně odeber uzel bez vstupních hran)",
    "t(u₀) := 0, ostatní t := −∞",
    "pro uzly v v topologickém pořadí:",
    "  t(v) := max{ t(u) + w(uv) : (u, v) ∈ H }",
    "Kritickou cestu zrekonstruuj zpětně přes předchůdce",
  ],
  validate: (g) => (!g.directed ? "Graf musí být orientovaný." : topoOrder(g) === null ? "Graf obsahuje cyklus – kritická cesta je definována jen pro acyklické grafy." : null),
  run(g, params) {
    const from = resolveNode(g, params.from, "first");
    const to = resolveNode(g, params.to, "last");
    const order = topoOrder(g)!;
    const rec = new Recorder();
    const pos = new Map(order.map((v, i) => [v, i + 1]));
    order.forEach((v) => rec.node(v, { label: `#${pos.get(v)}` }));
    rec.push(`Topologické uspořádání: ${order.join(" → ")} (čísla pod uzly). Všechny hrany vedou „dopředu".`, { line: 0 });
    const t = new Map(g.nodes.map((n) => [n.id, -INF]));
    const pred = new Map<string, number>();
    t.set(from, 0);
    order.forEach((v) => rec.node(v, { label: fmt(t.get(v)!) }));
    rec.node(from, { state: "source" });
    rec.push(`$t(${from}) = 0$, ostatní $-\\infty$.`, { line: 1 });
    for (const v of order) {
      const ins = g.edges.map((e, i) => ({ e, i })).filter(({ e }) => e.to === v && t.get(e.from)! > -INF);
      if (v === from || ins.length === 0) continue;
      let best = -INF;
      let bestEdge = -1;
      const parts: string[] = [];
      for (const { e, i } of ins) {
        const val = t.get(e.from)! + (e.w ?? 1);
        parts.push(`t(${e.from}) + ${e.w ?? 1} = ${val}`);
        rec.edge(i, { state: "considered" });
        if (val > best) [best, bestEdge] = [val, i];
      }
      t.set(v, best);
      pred.set(v, bestEdge);
      rec.node(v, { state: "active", label: fmt(best) });
      rec.push(`Uzel **${v}**: $t(${v}) = \\max\\{${parts.join(",\\ ")}\\} = ${best}$.`, { line: 3 });
      for (const { i } of ins) rec.edge(i, { state: i === bestEdge ? "tree" : "dim" });
      rec.node(v, { state: "done" });
    }
    if (t.get(to)! === -INF) {
      rec.push(`Uzel ${to} není z uzlu ${from} dosažitelný.`);
      return rec.steps;
    }
    let cur = to;
    const path = [to];
    for (let i = 0; i < g.edges.length; i++) rec.edge(i, { state: "dim" });
    while (cur !== from) {
      const ei = pred.get(cur)!;
      rec.edge(ei, { state: "path" });
      cur = g.edges[ei].from;
      path.unshift(cur);
    }
    path.forEach((v) => rec.node(v, { state: "path" }));
    rec.push(`Kritická cesta ${path.join(" → ")} má délku **${t.get(to)}**. Zpoždění kterékoli její činnosti zpozdí celý projekt.`, {
      line: 4,
    });
    return rec.steps;
  },
  relatedItems: ["alg-kriticka-cesta"],
};

