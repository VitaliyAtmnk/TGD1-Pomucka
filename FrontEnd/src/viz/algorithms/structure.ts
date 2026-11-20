import type { AlgorithmDef } from "../types";
import { adjacency, cmpId, Recorder, set, sortedIds } from "./common";
import { PRESETS } from "../presets";

// ---------------------------------------------------- Strong components (SCC)

export const scc: AlgorithmDef = {
  id: "scc",
  title: "Kvazikomponenty a kondenzace",
  short: "Kvazikomponenty",
  description:
    "Kvazikomponenta (silná komponenta) uzlu $u$ je tvořena uzly, které jsou z $u$ dosažitelné **a zároveň** se z nich lze do $u$ vrátit. " +
    "Vizualizace používá dvojí prohledání do hloubky (Kosaraju): první DFS určí pořadí dokončení uzlů, druhé DFS na grafu s **obrácenými hranami** " +
    "v opačném pořadí vydělí kvazikomponenty jednu po druhé. Složitost $O(n+m)$. Kondenzace (graf kvazikomponent) je vždy **acyklická**.",
  graphKind: "directed",
  weighted: false,
  params: [],
  presets: [
    { name: "Tři kvazikomponenty", graph: PRESETS.scc },
    { name: "Orientovaný graf", graph: PRESETS.directedSmall },
  ],
  pseudocode: [
    "1. DFS na G: zapisuj uzly v pořadí, v jakém jsou dokončeny",
    "2. Obrať orientaci všech hran",
    "3. Pro uzly v opačném pořadí dokončení:",
    "     není-li v ještě přiřazen, DFS z v v obráceném grafu → nová kvazikomponenta",
    "4. Kondenzace: kvazikomponenty jako uzly, hrana K→L, vede-li hrana z K do L",
  ],
  validate: (g) => (!g.directed ? "Kvazikomponenty se hledají v orientovaném grafu." : null),
  run(g) {
    const ids = sortedIds(g);
    const adj = adjacency(g);
    const radj = adjacency(g, true);
    const rec = new Recorder();
    const seen = new Set<string>();
    const finish: string[] = [];
    rec.push("Fáze 1: prohledávání do hloubky – zaznamenáme pořadí, ve kterém uzly **dokončíme**.", { line: 0 });
    const dfs1 = (v: string) => {
      seen.add(v);
      rec.node(v, { state: "active" });
      rec.push(`Navštívíme uzel **${v}**.`, { line: 0, info: [{ label: "Dokončené", value: finish.join(", ") || "–" }] });
      for (const a of adj.get(v)!) if (!seen.has(a.to)) {
        rec.edge(a.edge, { state: "tree" });
        dfs1(a.to);
      }
      finish.push(v);
      rec.node(v, { state: "visited", label: String(finish.length) });
      rec.push(`Uzel **${v}** je dokončen jako ${finish.length}.`, { line: 0, info: [{ label: "Dokončené", value: finish.join(", ") }] });
    };
    for (const v of ids) if (!seen.has(v)) dfs1(v);

    for (const v of ids) rec.node(v, { state: "default" });
    for (let i = 0; i < g.edges.length; i++) rec.edge(i, { state: "dim" });
    rec.push(`Fáze 2: hrany bereme **obráceně** a uzly v pořadí ${[...finish].reverse().join(", ")} (od posledního dokončeného).`, {
      line: 1,
    });
    const comp = new Map<string, number>();
    const comps: string[][] = [];
    for (const start of [...finish].reverse()) {
      if (comp.has(start)) continue;
      const c = comps.length;
      const members: string[] = [];
      const stack = [start];
      comp.set(start, c);
      while (stack.length) {
        const v = stack.pop()!;
        members.push(v);
        rec.node(v, { color: c, label: undefined });
        for (const a of radj.get(v)!) if (!comp.has(a.to)) {
          comp.set(a.to, c);
          stack.push(a.to);
        }
      }
      members.sort(cmpId);
      comps.push(members);
      g.edges.forEach((e, i) => {
        if (comp.get(e.from) === c && comp.get(e.to) === c) rec.edge(i, { state: "tree" });
      });
      rec.push(`Z uzlu **${start}** po obrácených hranách dosáhneme nepřiřazených uzlů $${set(members)}$ → **kvazikomponenta** $K_${c + 1}$.`, {
        line: 3,
      });
    }
    const condEdges = new Set<string>();
    g.edges.forEach((e, i) => {
      const [a, b] = [comp.get(e.from)!, comp.get(e.to)!];
      if (a !== b) {
        condEdges.add(`K${a + 1} → K${b + 1}`);
        rec.edge(i, { state: "default" });
      }
    });
    rec.push(
      `Graf má ${comps.length} kvazikomponent: ${comps.map((m, i) => `$K_${i + 1} = ${set(m)}$`).join(", ")}. ` +
        (comps.length === 1 ? "Graf je tedy **silně souvislý**." : `Graf **není** silně souvislý. Hrany kondenzace: ${[...condEdges].join(", ") || "žádné"}.`),
      {
        line: 4,
        tables: [
          {
            title: "Kondenzace",
            columns: ["Kvazikomponenta", "Uzly", "Hrany do"],
            rows: comps.map((m, i) => [
              `K${i + 1}`,
              m.join(", "),
              [...condEdges].filter((e) => e.startsWith(`K${i + 1} `)).map((e) => e.split("→ ")[1]).join(", ") || "–",
            ]),
          },
        ],
      },
    );
    return rec.steps;
  },
  relatedItems: ["def-kvazikomponenta", "def-kondenzace"],
};

// ------------------------------------------------------------ Greedy colouring

export const coloring: AlgorithmDef = {
  id: "coloring",
  title: "Hladové barvení grafu",
  short: "Barvení",
  description:
    "Uzly procházíme v pevném pořadí a každému dáme **nejmenší barvu**, kterou nemá žádný už obarvený soused. " +
    "Výsledek je vždy korektní obarvení s nejvýše $\\Delta(G)+1$ barvami (horní odhad věty 7.1), ale **nemusí být optimální** – závisí na pořadí uzlů " +
    "(zkus předvolbu „korunový graf“). Určit $\\chi(G)$ přesně je NP-těžké.",
  graphKind: "undirected",
  weighted: false,
  params: [
    {
      key: "order",
      label: "Pořadí uzlů",
      type: "select",
      options: [
        { value: "id", label: "Podle jména" },
        { value: "degree", label: "Podle stupně sestupně (Welsh–Powell)" },
        { value: "interleave", label: "Střídavě (a1, b1, a2, b2, …)" },
      ],
      default: "id",
    },
  ],
  presets: [
    { name: "Petersenův graf", graph: PRESETS.petersen, params: { order: "id" } },
    { name: "Korunový graf – špatné pořadí", graph: PRESETS.crown, params: { order: "interleave" } },
    { name: "Korunový graf – dobré pořadí", graph: PRESETS.crown, params: { order: "id" } },
    { name: "Sudá kružnice s tětivou", graph: PRESETS.bipartiteCycle, params: { order: "id" } },
  ],
  pseudocode: [
    "Urči pořadí uzlů v₁, …, vₙ",
    "pro i = 1, …, n:",
    "  c(vᵢ) := nejmenší barva různá od barev obarvených sousedů vᵢ",
    "Počet použitých barev je horní odhad χ(G)",
  ],
  validate: (g) => (g.directed ? "Barví se neorientované grafy." : null),
  run(g, params) {
    const adj = adjacency(g);
    let order = sortedIds(g);
    if (params.order === "degree") order = [...order].sort((a, b) => adj.get(b)!.length - adj.get(a)!.length || cmpId(a, b));
    if (params.order === "interleave") {
      const a = order.filter((_, i) => i < order.length / 2);
      const b = order.filter((_, i) => i >= order.length / 2);
      order = a.flatMap((v, i) => (b[i] ? [v, b[i]] : [v]));
    }
    const color = new Map<string, number>();
    const rec = new Recorder();
    rec.push(`Pořadí uzlů: ${order.join(", ")}.`, { line: 0 });
    for (const v of order) {
      const used = new Set(adj.get(v)!.map((a) => color.get(a.to)).filter((c): c is number => c !== undefined));
      let c = 0;
      while (used.has(c)) c++;
      color.set(v, c);
      adj.get(v)!.forEach((a) => color.has(a.to) && rec.edge(a.edge, { state: "considered" }));
      rec.node(v, { color: c, label: String(c + 1) });
      rec.push(
        `Uzel **${v}**: sousedé už mají barvy ${used.size ? `{${[...used].map((x) => x + 1).sort((p, q) => p - q).join(", ")}}` : "∅"} → dostane barvu **${c + 1}**.`,
        { line: 2 },
      );
      adj.get(v)!.forEach((a) => rec.edge(a.edge, { state: "default" }));
    }
    const k = new Set(color.values()).size;
    const maxDeg = Math.max(0, ...[...adj.values()].map((l) => l.length));
    rec.push(`Použito **${k}** barev, tedy $\\chi(G) \\le ${k}$ (a vždy $k \\le \\Delta(G) + 1 = ${maxDeg + 1}$). Optimalitu tím ale nedokazujeme.`, {
      line: 3,
    });
    return rec.steps;
  },
  relatedItems: ["def-chromaticke-cislo"],
};
