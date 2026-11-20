import type { AlgorithmDef } from "../types";
import { adjacency, cmpId, Recorder, set, sortedIds, topoOrder } from "./common";
import { PRESETS } from "../presets";

// ============================================================ kernel of a DAG

export const kernel: AlgorithmDef = {
  id: "kernel",
  title: "Jádro acyklického grafu",
  short: "Jádro",
  description:
    "Jádro orientovaného grafu je množina uzlů, která je **nezávislá** (žádná hrana uvnitř) a **dominantní** (z každého uzlu mimo ni vede hrana do ní). " +
    "Acyklický graf má jádro vždy a právě jedno (věta 6.8): uzly zpracujeme od konce topologického uspořádání – uzel patří do jádra, " +
    "právě když z něj nevede hrana do jádra. Výstupní uzly jsou tedy v jádru vždy. To je přesně Grundyho funkce s hodnotou 0. Složitost $O(n+m)$. " +
    "Ve hře „posuň žeton po hraně, kdo nemůže táhnout, prohrál“ jsou uzly jádra prohrávající pozice pro hráče na tahu.",
  graphKind: "directed",
  weighted: false,
  params: [],
  presets: [
    { name: "Acyklický graf", graph: PRESETS.dag, params: {} },
    { name: "Hra na grafu", graph: PRESETS.game, params: {} },
  ],
  pseudocode: [
    "Uspořádej uzly topologicky",
    "Procházej uzly od posledního:",
    "  nevede-li z v hrana do uzlu jádra → v patří do jádra",
    "  jinak v do jádra nepatří (je dominován)",
    "Výsledná množina je nezávislá i dominantní – jádro",
  ],
  validate: (g) =>
    !g.directed ? "Jádro zde hledáme v orientovaném grafu." : topoOrder(g) === null ? "Graf obsahuje cyklus – postup funguje jen pro acyklické grafy (cyklus liché délky jádro mít nemusí)." : null,
  run(g) {
    const order = topoOrder(g)!;
    const adj = adjacency(g);
    const rec = new Recorder();
    const inK = new Set<string>();
    order.forEach((v, i) => rec.node(v, { label: `#${i + 1}` }));
    rec.push(`Topologické uspořádání: ${order.join(", ")}. Budeme postupovat od konce.`, { line: 0 });
    for (const v of [...order].reverse()) {
      const out = adj.get(v)!;
      const hit = out.find((a) => inK.has(a.to));
      out.forEach((a) => rec.edge(a.edge, { state: inK.has(a.to) ? "path" : "considered" }));
      if (!hit) {
        inK.add(v);
        rec.node(v, { state: "done", label: "∈ J" });
        rec.push(
          out.length === 0
            ? `Uzel **${v}** je výstupní (nevede z něj žádná hrana) → patří do jádra.`
            : `Z uzlu **${v}** nevede hrana do jádra → **${v}** patří do jádra.`,
          { line: 2 },
        );
      } else {
        rec.node(v, { state: "rejected", label: "∉ J" });
        rec.push(`Z uzlu **${v}** vede hrana do uzlu jádra **${hit.to}** → ${v} do jádra nepatří (je dominován).`, { line: 3 });
      }
      out.forEach((a) => rec.edge(a.edge, { state: inK.has(a.to) ? "tree" : "dim" }));
    }
    rec.push(`Jádro $J = ${set([...inK].sort(cmpId))}$. Je nezávislé a z každého jiného uzlu do něj vede hrana (zeleně).`, { line: 4 });
    return rec.steps;
  },
};

// ===================================================== independent sets

export const independentSet: AlgorithmDef = {
  id: "independent-set",
  title: "Nezávislé množiny: hladově vs. největší",
  short: "Nezávislá množina",
  description:
    "**Maximální** nezávislou množinu (nejde rozšířit) najdeme hladově v lineárním čase: vezmeme uzel, vyřadíme jeho sousedy a opakujeme. " +
    "Každá maximální nezávislá množina je zároveň **jádro** neorientovaného grafu (věta 6.7) a minimální dominantní množina. " +
    "**Největší** nezávislá množina ($\\alpha(G)$) je ale jiný problém – rozhodovací verze IND je NP-úplná, takže známe jen exponenciální algoritmy. " +
    "Porovnej obě strategie: hladová volba může skončit s menší množinou.",
  graphKind: "undirected",
  weighted: false,
  params: [
    {
      key: "mode",
      label: "Strategie",
      type: "select",
      options: [
        { value: "greedy", label: "Hladově – uzel nejmenšího stupně" },
        { value: "greedy-max", label: "Hladově – uzel největšího stupně" },
        { value: "exact", label: "Největší (prohledání všech podmnožin)" },
      ],
      default: "greedy",
    },
  ],
  presets: [
    { name: "Hvězda K₁,₅ – hladově podle stupně špatně", graph: PRESETS.star, params: { mode: "greedy-max" } },
    { name: "Hvězda s ocasy", graph: PRESETS.starPaths, params: { mode: "greedy" } },
    { name: "Petersenův graf", graph: PRESETS.petersen, params: { mode: "greedy" } },
    { name: "Ohodnocený graf (bez vah)", graph: PRESETS.weighted, params: { mode: "exact" } },
  ],
  pseudocode: [
    "A := ∅, R := U(G)",
    "dokud R ≠ ∅: vyber uzel v z R podle strategie",
    "  A := A ∪ {v}, odeber v a všechny jeho sousedy z R",
    "A je maximální nezávislá množina (a jádro grafu)",
    "Největší: projdi podmnožiny od největších, první nezávislá je největší – O(2ⁿ · n²)",
  ],
  validate: (g, p) =>
    g.directed ? "Vizualizace pracuje s neorientovaným grafem." : p.mode === "exact" && g.nodes.length > 16 ? "Přesný výpočet jen do 16 uzlů." : null,
  run(g, params) {
    const adj = adjacency(g);
    const ids = sortedIds(g);
    const rec = new Recorder();
    const deg = (v: string, R: Set<string>) => adj.get(v)!.filter((a) => R.has(a.to)).length;
    if (params.mode === "exact") {
      const n = ids.length;
      const nb = ids.map((v) => new Set(adj.get(v)!.map((a) => a.to)));
      let best: string[] = [];
      let tested = 0;
      rec.push(`Hledáme největší nezávislou množinu mezi až $2^{${n}} = ${2 ** n}$ podmnožinami (s ořezáváním větví, které už nemohou překonat nejlepší nalezenou).`, { line: 4 });
      // iterate subsets by decreasing size would be expensive to enumerate; do a simple branch and bound
      const cur: number[] = [];
      const rec2 = (i: number) => {
        tested++;
        if (cur.length + (n - i) <= best.length) return;
        if (i === n) {
          best = cur.map((k) => ids[k]);
          return;
        }
        if (cur.every((k) => !nb[k].has(ids[i]))) {
          cur.push(i);
          rec2(i + 1);
          cur.pop();
        }
        rec2(i + 1);
      };
      rec2(0);
      ids.forEach((v) => rec.node(v, { state: best.includes(v) ? "done" : "default" }));
      rec.push(
        `Prohledáním s ořezáváním (${tested} uzlů stromu výpočtu, horní mez $2^{${n}} = ${2 ** n}$) je největší nezávislá množina $${set(best)}$, tedy $\\alpha(G) = ${best.length}$. ` +
          `Doplněk je minimální pokrytí, $\\beta(G) = ${n - best.length}$.`,
        { line: 4 },
      );
      return rec.steps;
    }
    const R = new Set(ids);
    const A: string[] = [];
    rec.push("Začínáme s prázdnou množinou A; všechny uzly jsou ještě k dispozici.", { line: 0 });
    while (R.size) {
      const cand = [...R].sort((a, b) => (params.mode === "greedy-max" ? deg(b, R) - deg(a, R) : deg(a, R) - deg(b, R)) || cmpId(a, b));
      const v = cand[0];
      const removed = adj.get(v)!.map((a) => a.to).filter((w) => R.has(w));
      A.push(v);
      R.delete(v);
      removed.forEach((w) => R.delete(w));
      rec.node(v, { state: "done" });
      removed.forEach((w) => rec.node(w, { state: "rejected" }));
      adj.get(v)!.forEach((a) => rec.edge(a.edge, { state: "dim" }));
      rec.push(
        `Vybereme **${v}** (stupeň ve zbytku ${deg(v, new Set([...R, v, ...removed]))}) a vyřadíme jeho sousedy ${removed.length ? `$${set(removed)}$` : "(žádné)"}.`,
        { line: 2, info: [{ label: "A", value: A.join(", ") }] },
      );
    }
    rec.push(
      `Hotovo: $A = ${set(A.sort(cmpId))}$ je maximální nezávislá množina velikosti ${A.length} – a tedy jádro grafu. ` +
        "Nemusí ale být největší; zkus strategii „Největší“.",
      { line: 3 },
    );
    return rec.steps;
  },
};
