import type { AlgorithmDef, Graph } from "../types";
import { clauseTex, formulaTex, litName, litTex, parseCnf, Recorder, set, strongComponents, type Clause, type Literal } from "./common";

const EMPTY: Graph = { directed: true, nodes: [], edges: [] };

function parsed(params: Record<string, string>) {
  return parseCnf(params.formula ?? "");
}

// ======================================================================= 2-SAT

interface ImplGraph {
  graph: Graph;
  clauseEdges: number[][]; // edge indices contributed by each clause
}

function implicationGraph(clauses: Clause[], vars: string[]): ImplGraph {
  const n = vars.length;
  const nodes = vars.flatMap((v, i) => {
    const x = n === 1 ? 5 : 0.5 + (9 * i) / (n - 1);
    return [
      { id: v, x, y: 1.5 },
      { id: `¬${v}`, x, y: 8.5 },
    ];
  });
  const edges: Graph["edges"] = [];
  const key = new Map<string, number>();
  const add = (a: string, b: string) => {
    const k = `${a}->${b}`;
    if (!key.has(k)) {
      key.set(k, edges.length);
      edges.push({ from: a, to: b });
    }
    return key.get(k)!;
  };
  const neg = (l: Literal) => litName({ v: l.v, neg: !l.neg });
  const clauseEdges = clauses.map((c) => {
    if (c.length === 1) return [add(neg(c[0]), litName(c[0]))];
    const [a, b] = c;
    return [add(neg(a), litName(b)), add(neg(b), litName(a))];
  });
  return { graph: { directed: true, nodes, edges }, clauseEdges };
}

const DEFAULT_2SAT = "(x1 ∨ x2) ∧ (¬x1 ∨ x3) ∧ (¬x2 ∨ ¬x3) ∧ (x2 ∨ ¬x3)";

export const twoSat: AlgorithmDef = {
  id: "two-sat",
  title: "2-SAT přes implikační graf",
  short: "2-SAT",
  description:
    "Klauzule $(a \\vee b)$ říká totéž co dvě implikace $\\bar a \\Rightarrow b$ a $\\bar b \\Rightarrow a$ – z nich sestrojíme **implikační graf**. " +
    "Literály v jedné kvazikomponentě musí mít stejnou hodnotu (lemma 9.3), takže formule je **splnitelná, právě když žádná kvazikomponenta neobsahuje $x$ i $\\bar x$** (lemma 9.4). " +
    "Splňující přiřazení dostaneme z topologického uspořádání kondenzace. Vše v čase $O(n+m)$, proto **2-SAT ∈ P**.",
  graphKind: "directed",
  weighted: false,
  editable: false,
  params: [
    {
      key: "formula",
      label: "Formule (2-KNF)",
      type: "text",
      default: DEFAULT_2SAT,
      placeholder: DEFAULT_2SAT,
      help: "Klauzule v závorkách, mezi literály ∨ (nebo v, |), negace ¬ (nebo !, ~, -).",
    },
  ],
  presets: [
    { name: "Splnitelná formule", graph: EMPTY, params: { formula: DEFAULT_2SAT } },
    { name: "Nesplnitelná formule", graph: EMPTY, params: { formula: "(x1 ∨ x2) ∧ (¬x1 ∨ x2) ∧ (x1 ∨ ¬x2) ∧ (¬x1 ∨ ¬x2)" } },
    { name: "Čtyři proměnné", graph: EMPTY, params: { formula: "(x1 ∨ ¬x2) ∧ (x2 ∨ x3) ∧ (¬x3 ∨ x4) ∧ (¬x4 ∨ ¬x1) ∧ (x3 ∨ x1)" } },
  ],
  pseudocode: [
    "Pro každou klauzuli (a ∨ b) přidej hrany ā → b a b̄ → a",
    "Najdi kvazikomponenty implikačního grafu",
    "Leží-li x a x̄ v jedné kvazikomponentě → formule je nesplnitelná",
    "Jinak x := 1, právě když kvazikomponenta x je v topologickém pořadí za kvazikomponentou x̄",
  ],
  validate: (_g, params) => {
    const r = parsed(params);
    if ("error" in r) return r.error;
    const long = r.clauses.find((c) => c.length > 2);
    if (long) return `Klauzule $${clauseTex(long)}$ má víc než dva literály – to už je 3-SAT, který je NP-úplný.`;
    if (r.vars.length > 8) return "Pro přehlednost nejvýše 8 proměnných.";
    return null;
  },
  displayGraph: (_g, params) => {
    const r = parsed(params);
    return "error" in r ? EMPTY : implicationGraph(r.clauses, r.vars).graph;
  },
  run(_g, params) {
    const r = parsed(params);
    if ("error" in r) return [];
    const { clauses, vars } = r;
    const { graph, clauseEdges } = implicationGraph(clauses, vars);
    const rec = new Recorder();
    graph.edges.forEach((_, i) => rec.edge(i, { state: "hidden" }));
    rec.push(`Formule $f = ${formulaTex(clauses)}$. Pro každou proměnnou máme dva uzly: $x_i$ nahoře a $\\overline{x_i}$ dole.`, { line: 0 });
    clauses.forEach((c, j) => {
      clauseEdges[j].forEach((i) => rec.edge(i, { state: "active" }));
      const impl =
        c.length === 1
          ? `$${litTex({ v: c[0].v, neg: !c[0].neg })} \\Rightarrow ${litTex(c[0])}$`
          : `$${litTex({ v: c[0].v, neg: !c[0].neg })} \\Rightarrow ${litTex(c[1])}$ a $${litTex({ v: c[1].v, neg: !c[1].neg })} \\Rightarrow ${litTex(c[0])}$`;
      rec.push(`Klauzule ${j + 1}: $${clauseTex(c)}$ dává implikace ${impl}.`, { line: 0 });
      clauseEdges[j].forEach((i) => rec.edge(i, { state: "default" }));
    });
    const { comps, compOf } = strongComponents(graph);
    comps.forEach((members, c) => members.forEach((v) => rec.node(v, { color: c })));
    rec.push(
      `Kvazikomponenty implikačního grafu (barvy): ${comps.map((m) => `$${set(m.map((v) => v.replace("¬", "\\neg ")))}$`).join(", ")}.`,
      { line: 1 },
    );
    const conflict = vars.find((v) => compOf.get(v) === compOf.get(`¬${v}`));
    if (conflict) {
      comps[compOf.get(conflict)!].forEach((v) => rec.node(v, { color: undefined, state: "path" }));
      rec.push(
        `Uzly $${litTex({ v: conflict, neg: false })}$ a $${litTex({ v: conflict, neg: true })}$ leží ve **stejné kvazikomponentě**: z $x$ plyne $\\bar x$ a z $\\bar x$ plyne $x$. ` +
          "Formule je **nesplnitelná**.",
        { line: 2 },
      );
      return rec.steps;
    }
    const value = new Map(vars.map((v) => [v, compOf.get(v)! > compOf.get(`¬${v}`)!]));
    vars.forEach((v) => {
      const t = value.get(v)!;
      rec.node(v, { color: undefined, state: t ? "done" : "rejected" });
      rec.node(`¬${v}`, { color: undefined, state: t ? "rejected" : "done" });
    });
    const assign = vars.map((v) => `$${litTex({ v, neg: false })} = ${value.get(v) ? 1 : 0}$`).join(", ");
    const ok = clauses.every((c) => c.some((l) => value.get(l.v) !== l.neg));
    rec.push(
      `Žádná kvazikomponenta neobsahuje proměnnou i její negaci → formule je **splnitelná**. ` +
        `Literál je pravdivý (modře), pokud jeho kvazikomponenta leží v topologickém pořadí později než komponenta jeho negace: ${assign}. ` +
        (ok ? "Dosazením ověříme, že všechny klauzule jsou splněné." : ""),
      { line: 3 },
    );
    return rec.steps;
  },
};

// ============================================================ 3-SAT -> IND

interface IndGraph {
  graph: Graph;
  triangle: number[][]; // edge indices of each clause triangle
  conflicts: number[];
  nodeOf: string[][]; // node ids per clause
}

function indGraph(clauses: Clause[]): IndGraph {
  const k = clauses.length;
  const nodes: Graph["nodes"] = [];
  const edges: Graph["edges"] = [];
  const nodeOf: string[][] = [];
  const triangle: number[][] = [];
  clauses.forEach((c, j) => {
    const cx = k === 1 ? 5 : 1 + (8 * j) / (k - 1);
    const ids = c.map((_, t) => `k${j + 1}.${t + 1}`);
    nodeOf.push(ids);
    const pos = c.length === 3 ? [[cx, 2.5], [cx - 1, 6.5], [cx + 1, 6.5]] : c.length === 2 ? [[cx - 0.8, 4.5], [cx + 0.8, 4.5]] : [[cx, 4.5]];
    c.forEach((l, t) => nodes.push({ id: ids[t], x: pos[t][0], y: pos[t][1], label: litName(l) }));
    const tri: number[] = [];
    for (let a = 0; a < ids.length; a++)
      for (let b = a + 1; b < ids.length; b++) {
        tri.push(edges.length);
        edges.push({ from: ids[a], to: ids[b] });
      }
    triangle.push(tri);
  });
  const conflicts: number[] = [];
  clauses.forEach((c, j) =>
    c.forEach((l, t) =>
      clauses.forEach((d, j2) => {
        if (j2 <= j) return;
        d.forEach((m, t2) => {
          if (m.v === l.v && m.neg !== l.neg) {
            conflicts.push(edges.length);
            edges.push({ from: nodeOf[j][t], to: nodeOf[j2][t2] });
          }
        });
      }),
    ),
  );
  return { graph: { directed: false, nodes, edges }, triangle, conflicts, nodeOf };
}

const DEFAULT_3SAT = "(x1 ∨ x2 ∨ ¬x3) ∧ (¬x1 ∨ x2 ∨ x3) ∧ (x1 ∨ ¬x2 ∨ x3)";

export const reduction3satInd: AlgorithmDef = {
  id: "reduction-3sat-ind",
  title: "Redukce 3-SAT → IND",
  short: "3-SAT → IND",
  description:
    "Důkaz NP-úplnosti nezávislosti (věta 9.8): z formule s $k$ klauzulemi sestrojíme graf, který má nezávislou množinu velikosti $k$, **právě když je formule splnitelná**. " +
    "Každá klauzule je trojúhelník ze svých literálů (z klauzule lze vybrat nejvýše jeden uzel) a každé dva **komplementární** výskyty $x$ a $\\bar x$ spojíme hranou " +
    "(nelze zvolit obojí). Graf má $3k$ uzlů a $O(k^2)$ hran, konstrukce je polynomiální.",
  graphKind: "undirected",
  weighted: false,
  editable: false,
  params: [
    {
      key: "formula",
      label: "Formule (3-KNF)",
      type: "text",
      default: DEFAULT_3SAT,
      placeholder: DEFAULT_3SAT,
      help: "Klauzule v závorkách s nejvýše třemi literály.",
    },
  ],
  presets: [
    { name: "Splnitelná formule (3 klauzule)", graph: EMPTY, params: { formula: DEFAULT_3SAT } },
    { name: "Čtyři klauzule", graph: EMPTY, params: { formula: "(x1 ∨ ¬x2 ∨ x3) ∧ (¬x1 ∨ x2 ∨ x4) ∧ (¬x3 ∨ ¬x4 ∨ x2) ∧ (x1 ∨ x3 ∨ ¬x4)" } },
    { name: "Nesplnitelná formule", graph: EMPTY, params: { formula: "(x1 ∨ x2) ∧ (¬x1 ∨ x2) ∧ (x1 ∨ ¬x2) ∧ (¬x1 ∨ ¬x2)" } },
  ],
  pseudocode: [
    "Pro každou klauzuli vytvoř trojúhelník z jejích literálů",
    "Spoj hranou každé dva komplementární literály (x a x̄) z různých klauzulí",
    "k := počet klauzulí; instance IND je (G, k)",
    "f splnitelná ⇒ z každé klauzule vyber jeden pravdivý literál → nezávislá množina velikosti k",
    "nezávislá množina velikosti k ⇒ její literály polož = 1 (bez sporu) → f je splněná",
  ],
  validate: (_g, params) => {
    const r = parsed(params);
    if ("error" in r) return r.error;
    if (r.clauses.some((c) => c.length > 3)) return "Každá klauzule smí mít nejvýše 3 literály (3-SAT).";
    if (r.clauses.length > 6) return "Pro přehlednost nejvýše 6 klauzulí.";
    if (r.vars.length > 10) return "Nejvýše 10 proměnných.";
    return null;
  },
  displayGraph: (_g, params) => {
    const r = parsed(params);
    return "error" in r ? { directed: false, nodes: [], edges: [] } : indGraph(r.clauses).graph;
  },
  run(_g, params) {
    const r = parsed(params);
    if ("error" in r) return [];
    const { clauses, vars } = r;
    const { graph, triangle, conflicts, nodeOf } = indGraph(clauses);
    const rec = new Recorder();
    graph.edges.forEach((_, i) => rec.edge(i, { state: "hidden" }));
    graph.nodes.forEach((n) => rec.node(n.id, { state: "rejected" }));
    rec.push(`Formule $f = ${formulaTex(clauses)}$ má $k = ${clauses.length}$ klauzulí.`, { line: 0 });
    clauses.forEach((c, j) => {
      nodeOf[j].forEach((id) => rec.node(id, { state: "default", label: `K${j + 1}` }));
      triangle[j].forEach((i) => rec.edge(i, { state: "active" }));
      rec.push(`Klauzule ${j + 1}: $${clauseTex(c)}$ → trojúhelník. Z něj lze do nezávislé množiny vybrat nejvýše jeden uzel.`, { line: 0 });
      triangle[j].forEach((i) => rec.edge(i, { state: "default" }));
    });
    graph.nodes.forEach((n) => rec.node(n.id, { label: undefined }));
    conflicts.forEach((i) => rec.edge(i, { state: "path" }));
    rec.push(
      `Spojíme komplementární literály (${conflicts.length} hran, červeně): proměnná nemůže být současně pravdivá i nepravdivá.`,
      { line: 1 },
    );
    conflicts.forEach((i) => rec.edge(i, { state: "back" }));
    rec.push(`Instance IND: graf se ${graph.nodes.length} uzly a ${graph.edges.length} hranami a číslo $k = ${clauses.length}$.`, { line: 2 });

    // find a satisfying assignment by brute force (small formulas only)
    let sat: Map<string, boolean> | null = null;
    for (let mask = 0; mask < 1 << vars.length && !sat; mask++) {
      const val = new Map(vars.map((v, i) => [v, ((mask >> i) & 1) === 1]));
      if (clauses.every((c) => c.some((l) => val.get(l.v) !== l.neg))) sat = val;
    }
    if (!sat) {
      rec.push(
        "Formule je **nesplnitelná** (žádné přiřazení nesplní všechny klauzule), takže graf **nemá** nezávislou množinu velikosti $k$ – " +
          "z každého trojúhelníku by musel být jeden uzel a mezi nimi by vždy byla hrana $x$–$\\bar x$.",
        { line: 4 },
      );
      return rec.steps;
    }
    const chosen = clauses.map((c, j) => nodeOf[j][c.findIndex((l) => sat!.get(l.v) !== l.neg)]);
    graph.nodes.forEach((n) => rec.node(n.id, { state: chosen.includes(n.id) ? "done" : "default" }));
    const assign = vars.map((v) => `$${litTex({ v, neg: false })} = ${sat!.get(v) ? 1 : 0}$`).join(", ");
    rec.push(
      `Splňující přiřazení ${assign}. Z každé klauzule vybereme jeden pravdivý literál (modře) – dostaneme **nezávislou množinu velikosti ${clauses.length}**: ` +
        "v žádném trojúhelníku nejsou dva vybrané uzly a komplementární dvojice nemohou být obě pravdivé.",
      { line: 3 },
    );
    return rec.steps;
  },
};
