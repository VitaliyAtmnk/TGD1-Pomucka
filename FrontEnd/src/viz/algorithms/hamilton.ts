import type { AlgorithmDef, Graph } from "../types";
import { adjacency, Recorder, resolveNode, sortedIds } from "./common";
import { PRESETS } from "../presets";

const STEP_LIMIT = 400;

// ====================================================== backtracking

export const hamiltonBacktracking: AlgorithmDef = {
  id: "hamilton-backtracking",
  title: "Backtracking pro hamiltonovskou kružnici",
  short: "Backtracking",
  description:
    "Cestu prodlužujeme o dosud nepoužitý soused posledního uzlu. Když to nejde, **vrátíme se** (backtrack) a zkusíme jiného souseda o úroveň výš. " +
    "Kružnice je nalezena, když cesta obsahuje všechny uzly a poslední uzel sousedí s prvním. V nejhorším případě algoritmus projde až $(n-1)!$ cest – " +
    "problém hamiltonovské kružnice je NP-úplný a polynomiální algoritmus se nezná. Počet kroků je tu omezený na " + STEP_LIMIT + ".",
  graphKind: "undirected",
  weighted: false,
  params: [{ key: "start", label: "Počáteční uzel", type: "node", default: "first" }],
  presets: [
    { name: "Krychle Q₃", graph: PRESETS.cube, params: { start: "1" } },
    { name: "Petersenův graf (není hamiltonovský)", graph: PRESETS.petersen, params: { start: "1" } },
    { name: "Ohodnocený graf (bez vah)", graph: PRESETS.weighted, params: { start: "1" } },
  ],
  pseudocode: [
    "P := (s)",
    "je-li |P| = n a poslední uzel sousedí s s → hamiltonovská kružnice nalezena",
    "existuje-li nepoužitý soused w posledního uzlu (dosud nezkoušený): P := P + w",
    "jinak: odeber poslední uzel z P (návrat) a zkus jeho dalšího souseda",
    "P = () → graf není hamiltonovský",
  ],
  validate: (g) => (g.directed ? "Vizualizace pracuje s neorientovaným grafem." : g.nodes.length < 3 ? "Graf musí mít aspoň 3 uzly." : null),
  run(g, params) {
    const adj = adjacency(g);
    const n = g.nodes.length;
    const s = resolveNode(g, params.start);
    const rec = new Recorder();
    const path: { v: string; edge: number | null }[] = [{ v: s, edge: null }];
    const onPath = new Set([s]);
    const tried: number[] = [0];
    let steps = 0;
    let backtracks = 0;
    const show = (msg: string, line: number) => {
      g.edges.forEach((_, i) => rec.edge(i, { state: "default" }));
      g.nodes.forEach((nd) => rec.node(nd.id, { state: "default", label: undefined }));
      path.forEach((p, k) => {
        rec.node(p.v, { state: k === path.length - 1 ? "active" : "visited", label: String(k + 1) });
        if (p.edge !== null) rec.edge(p.edge, { state: "path" });
      });
      rec.push(msg, { line, info: [{ label: "Cesta", value: path.map((p) => p.v).join(" – ") }, { label: "Návratů", value: String(backtracks) }] });
    };
    show(`Začínáme v uzlu **${s}**.`, 0);
    while (path.length && steps < STEP_LIMIT) {
      steps++;
      const last = path[path.length - 1].v;
      if (path.length === n) {
        const closing = adj.get(last)!.find((a) => a.to === s);
        if (closing) {
          show(`Cesta obsahuje všech ${n} uzlů a **${last}** sousedí s **${s}**.`, 1);
          rec.edge(closing.edge, { state: "path" });
          path.forEach((p) => rec.node(p.v, { state: "done" }));
          rec.push(`Hamiltonovská kružnice: ${[...path.map((p) => p.v), s].join(" – ")} (po ${backtracks} návratech).`, { line: 1 });
          return rec.steps;
        }
      }
      const options = adj.get(last)!.filter((a) => !onPath.has(a.to));
      const k = tried[tried.length - 1];
      if (k < options.length && path.length < n) {
        tried[tried.length - 1]++;
        const a = options[k];
        path.push({ v: a.to, edge: a.edge });
        onPath.add(a.to);
        tried.push(0);
        show(`Prodloužíme cestu o souseda **${a.to}**.`, 2);
      } else {
        const removed = path.pop()!;
        onPath.delete(removed.v);
        tried.pop();
        backtracks++;
        if (!path.length) break;
        show(
          path.length + 1 === n
            ? `Cesta přes všechny uzly končí v **${removed.v}**, který nesousedí s ${s} → **návrat**.`
            : `Z uzlu **${removed.v}** nevede hrana do nepoužitého uzlu → **návrat** do ${path[path.length - 1].v}.`,
          3,
        );
      }
    }
    if (steps >= STEP_LIMIT) rec.push(`Zastaveno po ${STEP_LIMIT} krocích – i malé grafy mohou vyžadovat obrovský počet kroků.`, { line: 3 });
    else rec.push(`Všechny možnosti vyčerpány (${backtracks} návratů): graf **není hamiltonovský**.`, { line: 4 });
    return rec.steps;
  },
};

// ======================================================= Bondy–Chvátal closure

function closureEdges(g: Graph): { added: [string, string, number][] } {
  const ids = sortedIds(g);
  const n = ids.length;
  const nb = new Map(ids.map((v) => [v, new Set<string>()]));
  g.edges.forEach((e) => {
    nb.get(e.from)!.add(e.to);
    nb.get(e.to)!.add(e.from);
  });
  const added: [string, string, number][] = [];
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < n && !changed; i++)
      for (let j = i + 1; j < n && !changed; j++) {
        const [u, v] = [ids[i], ids[j]];
        const sum = nb.get(u)!.size + nb.get(v)!.size;
        if (!nb.get(u)!.has(v) && sum >= n) {
          nb.get(u)!.add(v);
          nb.get(v)!.add(u);
          added.push([u, v, sum]);
          changed = true;
        }
      }
  }
  return { added };
}

export const bondyChvatal: AlgorithmDef = {
  id: "bondy-chvatal",
  title: "Uzávěr grafu (Bondy–Chvátal)",
  short: "Uzávěr grafu",
  description:
    "Uzávěr $cl(G)$ vznikne opakovaným přidáváním hran mezi **nesousedními** uzly $u, v$ se součtem stupňů $d(u) + d(v) \\ge n$. " +
    "Podle Oreho lemmatu přidaná hrana nemění hamiltonovskost, takže **$G$ je hamiltonovský, právě když $cl(G)$ je hamiltonovský** (věta Bondy–Chvátal). " +
    "Je-li uzávěr úplný graf, je $G$ hamiltonovský – odtud plynou věty Diraca ($\\delta \\ge n/2$) i Oreho. Uzávěr spočteme polynomiálně.",
  graphKind: "undirected",
  weighted: false,
  params: [],
  presets: [
    { name: "Uzávěr je úplný graf", graph: PRESETS.closureFull, params: {} },
    { name: "Uzávěr není úplný", graph: PRESETS.closurePartial, params: {} },
    { name: "Petersenův graf (nic nepřibude)", graph: PRESETS.petersen, params: {} },
  ],
  pseudocode: [
    "opakuj:",
    "  najdi nesousední u, v s d(u) + d(v) ≥ n (stupně v aktuálním grafu)",
    "  přidej hranu uv",
    "dokud se něco přidalo; výsledek je cl(G) (nezávisí na pořadí)",
    "cl(G) úplný ⇒ G je hamiltonovský",
  ],
  validate: (g) => (g.directed ? "Vizualizace pracuje s neorientovaným grafem." : g.nodes.length < 3 ? "Graf musí mít aspoň 3 uzly." : null),
  displayGraph: (g) => {
    const { added } = closureEdges(g);
    return { ...g, edges: [...g.edges, ...added.map(([u, v]) => ({ from: u, to: v }))] };
  },
  run(g) {
    const { added } = closureEdges(g);
    const ids = sortedIds(g);
    const n = ids.length;
    const m0 = g.edges.length;
    const rec = new Recorder();
    const deg = new Map(ids.map((v) => [v, 0]));
    g.edges.forEach((e) => (deg.set(e.from, deg.get(e.from)! + 1), deg.set(e.to, deg.get(e.to)! + 1)));
    added.forEach((_, k) => rec.edge(m0 + k, { state: "hidden" }));
    ids.forEach((v) => rec.node(v, { label: `d=${deg.get(v)}` }));
    rec.push(`Graf má $n = ${n}$ uzlů. Hledáme nesousední dvojice se součtem stupňů alespoň ${n}.`, { line: 0 });
    added.forEach(([u, v, sum], k) => {
      ids.forEach((w) => rec.node(w, { state: "default" }));
      rec.node(u, { state: "active" }).node(v, { state: "active" });
      rec.edge(m0 + k, { state: "considered" });
      rec.push(`Uzly **${u}** a **${v}** nesousedí a $d(${u}) + d(${v}) = ${deg.get(u)} + ${deg.get(v)} = ${sum} \\ge ${n}$ → přidáme hranu ${u}${v}.`, {
        line: 2,
      });
      deg.set(u, deg.get(u)! + 1);
      deg.set(v, deg.get(v)! + 1);
      rec.node(u, { label: `d=${deg.get(u)}` }).node(v, { label: `d=${deg.get(v)}` });
      rec.edge(m0 + k, { state: "tree" });
    });
    ids.forEach((w) => rec.node(w, { state: "default" }));
    const complete = m0 + added.length === (n * (n - 1)) / 2;
    rec.push(
      `Uzávěr hotov: přidáno ${added.length} hran (zeleně). ` +
        (complete
          ? "$cl(G)$ je **úplný graf**, a proto je $G$ **hamiltonovský**."
          : `$cl(G)$ není úplný (chybí ${(n * (n - 1)) / 2 - m0 - added.length} hran) – věta o hamiltonovskosti nic neříká, je potřeba jiný postup (např. backtracking).`),
      { line: complete ? 4 : 3 },
    );
    return rec.steps;
  },
};

