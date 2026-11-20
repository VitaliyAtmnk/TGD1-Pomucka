import type { AlgorithmDef } from "../types";
import { adjacency, Recorder, resolveNode, set } from "./common";
import { PRESETS } from "../presets";

export const mst: AlgorithmDef = {
  id: "mst",
  title: "Minimální kostra (Kruskal, Jarník)",
  short: "Minimální kostra",
  description:
    "**Kruskal** (hladový algoritmus) prochází hrany od nejlehčí a přidá hranu, pokud nevytvoří kružnici – komponenty lesa se postupně slévají. " +
    "**Jarník (Prim)** pěstuje jediný strom z počátečního uzlu a vždy přidá nejlehčí hranu, která z něj vede ven. " +
    "Oba jsou správné díky tomu, že nejlehčí hrana libovolného řezu patří do nějaké minimální kostry. Složitost $O(m \\log m)$, resp. $O(n^2)$.",
  graphKind: "undirected",
  weighted: true,
  weightLabel: "w",
  params: [
    {
      key: "mode",
      label: "Algoritmus",
      type: "select",
      options: [
        { value: "kruskal", label: "Kruskal" },
        { value: "jarnik", label: "Jarník (Prim)" },
      ],
      default: "kruskal",
    },
    { key: "start", label: "Počátek (Jarník)", type: "node", default: "first" },
  ],
  presets: [
    { name: "Ohodnocený graf", graph: PRESETS.weighted, params: { mode: "kruskal", start: "1" } },
    { name: "Petersenův graf (rovné váhy)", graph: { ...PRESETS.petersen, edges: PRESETS.petersen.edges.map((e, i) => ({ ...e, w: (i * 7) % 5 + 1 })) }, params: { mode: "jarnik", start: "1" } },
  ],
  pseudocode: (p) =>
    p.mode === "jarnik"
      ? [
          "T := ({u₀}, ∅)",
          "dokud T nepokrývá všechny uzly:",
          "  vyber nejlehčí hranu uv s u ∈ T, v ∉ T",
          "  přidej v a uv do T",
        ]
      : [
          "Seřaď hrany podle váhy vzestupně, T := (U, ∅)",
          "pro každou hranu e v tomto pořadí:",
          "  spojuje-li e dvě různé komponenty T: přidej e do T",
          "  jinak e vynech (vytvořila by kružnici)",
        ],
  validate: (g) => (g.directed ? "Minimální kostra se hledá v neorientovaném grafu." : null),
  run(g, params) {
    const rec = new Recorder();
    let total = 0;
    let count = 0;
    if (params.mode === "jarnik") {
      const start = resolveNode(g, params.start);
      const adj = adjacency(g);
      const inTree = new Set([start]);
      rec.node(start, { state: "done" });
      rec.push(`Začínáme stromem obsahujícím jen uzel **${start}**.`, { line: 0 });
      while (inTree.size < g.nodes.length) {
        let best: { from: string; to: string; w: number; edge: number } | null = null;
        for (const u of inTree)
          for (const a of adj.get(u)!) {
            if (inTree.has(a.to)) continue;
            rec.edge(a.edge, { state: "considered" });
            if (!best || a.w < best.w) best = { from: u, ...a };
          }
        if (!best) {
          rec.push("Z aktuálního stromu nevede žádná hrana ven – graf není souvislý, kostra neexistuje.");
          return rec.steps;
        }
        rec.push(`Hrany vedoucí ze stromu ven (oranžové); nejlehčí je **${best.from}${best.to}** s vahou ${best.w}.`, { line: 2 });
        for (const i of Object.keys(rec.edges).map(Number)) if (rec.edges[i].state === "considered") rec.edge(i, { state: "default" });
        rec.edge(best.edge, { state: "tree" }).node(best.to, { state: "done" });
        inTree.add(best.to);
        total += best.w;
        count++;
        rec.push(`Přidáme uzel **${best.to}** a hranu ${best.from}${best.to}. Váha stromu: ${total}.`, { line: 3 });
      }
    } else {
      const order = g.edges.map((e, i) => ({ ...e, i, w: e.w ?? 1 })).sort((a, b) => a.w - b.w || a.i - b.i);
      const comp = new Map(g.nodes.map((n, i) => [n.id, i]));
      const colorOf = () => {
        const roots = [...new Set(comp.values())];
        for (const [v, c] of comp) rec.node(v, { color: roots.indexOf(c) });
      };
      colorOf();
      rec.push(`Hrany seřazené podle váhy: ${order.map((e) => `${e.from}${e.to} (${e.w})`).join(", ")}. Na začátku je každý uzel samostatnou komponentou (barvy).`, {
        line: 0,
      });
      for (const e of order) {
        const [ca, cb] = [comp.get(e.from)!, comp.get(e.to)!];
        if (ca !== cb) {
          for (const [v, c] of comp) if (c === cb) comp.set(v, ca);
          rec.edge(e.i, { state: "tree" });
          total += e.w;
          count++;
          colorOf();
          rec.push(`Hrana **${e.from}${e.to}** (${e.w}) spojuje dvě různé komponenty → přidáme ji. Váha: ${total}.`, { line: 2 });
          if (count === g.nodes.length - 1) break;
        } else {
          rec.edge(e.i, { state: "rejected" });
          rec.push(`Hrana **${e.from}${e.to}** (${e.w}) má oba konce ve stejné komponentě – vytvořila by kružnici, vynecháme ji.`, { line: 3 });
        }
      }
      if (count < g.nodes.length - 1) {
        rec.push("Hrany došly a komponent je víc – graf není souvislý, výsledkem je minimální kostra každé komponenty (les).");
        return rec.steps;
      }
    }
    for (let i = 0; i < g.edges.length; i++) if (rec.edges[i]?.state !== "tree") rec.edge(i, { state: "dim" });
    rec.push(`Hotovo: minimální kostra má ${count} hran a celkovou váhu **${total}**. Uzly: $${set(g.nodes.map((n) => n.id))}$.`);
    return rec.steps;
  },
  relatedItems: ["alg-kruskal", "alg-jarnik"],
};
