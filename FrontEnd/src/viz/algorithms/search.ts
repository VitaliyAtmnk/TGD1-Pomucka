import type { AlgorithmDef } from "../types";
import { adjacency, Recorder, resolveNode, set, sortedIds } from "./common";
import { PRESETS } from "../presets";

export const graphSearch: AlgorithmDef = {
  id: "graph-search",
  title: "Prohledávání grafu (BFS / DFS)",
  short: "BFS / DFS",
  description:
    "Obecný algoritmus prohledávání (alg. 5.1) postupně objevuje uzly dosažitelné z počátečního uzlu. " +
    "Rozdíl mezi prohledáváním **do šířky** a **do hloubky** je jen v tom, zda nové uzly ukládáme do **fronty** (FIFO) nebo **zásobníku** (LIFO). " +
    "Každý uzel i hrana se zpracují nejvýše dvakrát, složitost je tedy $O(n+m)$. Stromové hrany tvoří kostru komponenty.",
  graphKind: "any",
  weighted: false,
  params: [
    { key: "start", label: "Počáteční uzel", type: "node", default: "first" },
    {
      key: "mode",
      label: "Strategie",
      type: "select",
      options: [
        { value: "bfs", label: "Do šířky (fronta)" },
        { value: "dfs", label: "Do hloubky (zásobník)" },
      ],
      default: "bfs",
    },
  ],
  presets: [
    { name: "Strom s cykly", graph: PRESETS.search, params: { start: "a", mode: "bfs" } },
    { name: "Dvě komponenty", graph: PRESETS.twoComponents, params: { start: "1", mode: "dfs" } },
    { name: "Orientovaný graf", graph: PRESETS.directedSmall, params: { start: "1", mode: "bfs" } },
  ],
  pseudocode: (p) =>
    p.mode === "dfs"
      ? [
          "Označ počáteční uzel s jako objevený, Z := (s)  // zásobník",
          "dokud Z není prázdný:",
          "  v := vrchol zásobníku",
          "  existuje-li neprozkoumaná hrana vw:",
          "    je-li w neobjevený: označ w, vw je stromová, vlož w na Z",
          "  jinak: odeber v ze Z (v je zpracovaný)",
        ]
      : [
          "Označ počáteční uzel s jako objevený, F := (s)  // fronta",
          "dokud F není prázdná:",
          "  v := odeber první uzel z F",
          "  pro každou hranu vw:",
          "    je-li w neobjevený: označ w, vw je stromová, přidej w na konec F",
          "  v je zpracovaný",
        ],
  run(g, params) {
    const start = resolveNode(g, params.start);
    const dfs = params.mode === "dfs";
    const adj = adjacency(g);
    const rec = new Recorder();
    const order: string[] = [];
    const found = new Set<string>([start]);
    const level = new Map<string, number>([[start, 0]]);
    let counter = 1;
    rec.node(start, { state: "frontier", label: dfs ? "1" : "0" });
    order.push(start);
    const container: string[] = [start];
    const name = dfs ? "Zásobník" : "Fronta";
    const info = () => [
      { label: name, value: container.length ? container.join(", ") : "∅" },
      { label: "Pořadí objevení", value: order.join(", ") },
    ];
    rec.push(`Začínáme v uzlu **${start}**, vložíme ho do ${dfs ? "zásobníku" : "fronty"}.`, { line: 0, info: info() });

    if (!dfs) {
      while (container.length) {
        const v = container.shift()!;
        rec.node(v, { state: "active" });
        rec.push(`Odebereme **${v}** z čela fronty a projdeme jeho sousedy.`, { line: 2, info: info() });
        for (const a of adj.get(v)!) {
          if (!found.has(a.to)) {
            found.add(a.to);
            level.set(a.to, level.get(v)! + 1);
            order.push(a.to);
            container.push(a.to);
            rec.edge(a.edge, { state: "tree" }).node(a.to, { state: "frontier", label: String(level.get(a.to)) });
            rec.push(`Uzel **${a.to}** je nový → stromová hrana ${v}${a.to}, ${a.to} jde na konec fronty (vzdálenost ${level.get(a.to)}).`, {
              line: 4,
              info: info(),
            });
          } else if (rec.edges[a.edge]?.state !== "tree") {
            rec.edge(a.edge, { state: "dim" });
          }
        }
        rec.node(v, { state: "done" });
        rec.push(`Uzel **${v}** je zpracovaný.`, { line: 5, info: info() });
      }
    } else {
      const next = new Map<string, number>();
      while (container.length) {
        const v = container[container.length - 1];
        const list = adj.get(v)!;
        let i = next.get(v) ?? 0;
        rec.node(v, { state: "active" });
        while (i < list.length && found.has(list[i].to)) {
          if (rec.edges[list[i].edge]?.state !== "tree") rec.edge(list[i].edge, { state: "back" });
          i++;
        }
        next.set(v, i + 1);
        if (i < list.length) {
          const a = list[i];
          found.add(a.to);
          order.push(a.to);
          container.push(a.to);
          counter++;
          rec.node(v, { state: "frontier" });
          rec.edge(a.edge, { state: "tree" }).node(a.to, { state: "active", label: String(counter) });
          rec.push(`Z uzlu **${v}** jdeme hlouběji do nového uzlu **${a.to}** (stromová hrana).`, { line: 4, info: info() });
        } else {
          container.pop();
          rec.node(v, { state: "done" });
          rec.push(`Uzel **${v}** nemá neobjevené sousedy → odebereme ho ze zásobníku (návrat).`, { line: 5, info: info() });
        }
      }
    }
    const unreached = sortedIds(g).filter((v) => !found.has(v));
    rec.push(
      `Hotovo. Objeveno ${found.size} uzlů v pořadí ${order.join(", ")}. Stromové hrany tvoří kostru komponenty uzlu ${start}.` +
        (unreached.length
          ? ` Uzly $${set(unreached)}$ nejsou z **${start}** dosažitelné – ${g.directed ? "graf není silně souvislý" : "graf není souvislý"}.`
          : ""),
      { info: info() },
    );
    return rec.steps;
  },
  relatedItems: ["alg-prohledavani"],
};
