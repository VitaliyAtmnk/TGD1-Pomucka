import type { AlgorithmDef, StepTable } from "../types";
import { adjacency, Recorder, resolveNode, set, sortedIds } from "./common";
import { PRESETS } from "../presets";

export const blocks: AlgorithmDef = {
  id: "blocks",
  title: "Mosty, artikulace a bloky (Tarjan)",
  short: "Bloky",
  description:
    "Jedno prohledání do hloubky stačí k nalezení všech artikulací, mostů a bloků. Uzel dostane **číslo prohledání** $p(v)$ " +
    "a **dolní číslo** $r(v)$ = nejmenší $p$, kam se lze z podstromu $v$ dostat jednou zpětnou hranou. " +
    "Nekořenový uzel $x$ je artikulace, má-li syna $y$ s $r(y) \\ge p(x)$; hrana $xy$ je most, je-li $r(y) > p(x)$; kořen je artikulace, má-li aspoň dva syny. " +
    "Hrany ukládané na zásobník se při splnění podmínky vydají jako jeden **blok**. Složitost $O(n+m)$.",
  graphKind: "undirected",
  weighted: false,
  params: [{ key: "start", label: "Kořen prohledávání", type: "node", default: "first" }],
  presets: [
    { name: "Tři bloky a most", graph: PRESETS.blocks, params: { start: "1" } },
    { name: "Strom (každá hrana je most)", graph: PRESETS.tree, params: { start: "1" } },
    { name: "Petersenův graf (2-souvislý)", graph: PRESETS.petersen, params: { start: "1" } },
  ],
  pseudocode: [
    "DFS z kořene, uzlu v přiřaď p(v) := pořadí, r(v) := p(v); hrany ukládej na zásobník",
    "zpětná hrana vw:  r(v) := min(r(v), p(w))",
    "po návratu ze syna y:  r(x) := min(r(x), r(y))",
    "je-li r(y) ≥ p(x): vydej ze zásobníku hrany až po xy → blok; x je artikulace (kořen jen při ≥ 2 synech)",
    "je-li navíc r(y) > p(x): xy je most",
  ],
  validate: (g) => (g.directed ? "Bloky se hledají v neorientovaném grafu." : null),
  run(g, params) {
    const adj = adjacency(g);
    const ids = sortedIds(g);
    const rec = new Recorder();
    const p = new Map<string, number>();
    const r = new Map<string, number>();
    const edgeStack: number[] = [];
    const articulations = new Set<string>();
    const bridges: number[] = [];
    const blockList: string[][] = [];
    let counter = 0;
    const table = (): StepTable => ({
      columns: ids,
      rowHeaders: ["p(v)", "r(v)"],
      rows: [ids.map((v) => (p.has(v) ? String(p.get(v)) : "–")), ids.map((v) => (r.has(v) ? String(r.get(v)) : "–"))],
    });
    const label = (v: string) => rec.node(v, { label: `${p.get(v)}/${r.get(v)}` });

    const dfs = (x: string, parentEdge: number | null, isRoot: boolean) => {
      counter++;
      p.set(x, counter);
      r.set(x, counter);
      rec.node(x, { state: "active" });
      label(x);
      rec.push(`Navštívíme uzel **${x}**: $p(${x}) = r(${x}) = ${counter}$.`, { line: 0, tables: [table()] });
      let children = 0;
      for (const a of adj.get(x)!) {
        if (a.edge === parentEdge) continue;
        const y = a.to;
        if (!p.has(y)) {
          children++;
          edgeStack.push(a.edge);
          rec.edge(a.edge, { state: "considered" });
          rec.node(x, { state: "visited" });
          dfs(y, a.edge, false);
          r.set(x, Math.min(r.get(x)!, r.get(y)!));
          rec.node(x, { state: "active" });
          label(x);
          rec.push(`Návrat z **${y}** do **${x}**: $r(${x}) = \\min(r(${x}), r(${y})) = ${r.get(x)}$.`, { line: 2, tables: [table()] });
          if (r.get(y)! >= p.get(x)!) {
            const block: number[] = [];
            let e: number;
            do {
              e = edgeStack.pop()!;
              block.push(e);
            } while (e !== a.edge);
            const nodes = new Set<string>();
            block.forEach((i) => (nodes.add(g.edges[i].from), nodes.add(g.edges[i].to)));
            const c = blockList.length;
            blockList.push([...nodes].sort());
            block.forEach((i) => rec.edge(i, { state: "default" }));
            nodes.forEach((v) => rec.node(v, { color: c }));
            if (!isRoot) articulations.add(x);
            const bridge = r.get(y)! > p.get(x)!;
            if (bridge) {
              bridges.push(a.edge);
              rec.edge(a.edge, { state: "cut" });
            }
            rec.push(
              `$r(${y}) = ${r.get(y)} \\ge p(${x}) = ${p.get(x)}$ → hrany ze zásobníku tvoří **blok** $${set([...nodes].sort())}$.` +
                (bridge ? ` Protože $r(${y}) > p(${x})$, je hrana ${x}${y} **most**.` : "") +
                (isRoot ? " U kořene rozhodne až počet synů ve stromu prohledávání." : ` Uzel **${x}** je **artikulace**.`),
              { line: bridge ? 4 : 3, tables: [table()] },
            );
          }
        } else if (p.get(y)! < p.get(x)!) {
          edgeStack.push(a.edge);
          r.set(x, Math.min(r.get(x)!, p.get(y)!));
          rec.edge(a.edge, { state: "back" });
          label(x);
          rec.push(`Zpětná hrana **${x}${y}**: $r(${x}) = \\min(r(${x}), p(${y})) = ${r.get(x)}$.`, { line: 1, tables: [table()] });
        }
      }
      if (isRoot && children >= 2) articulations.add(x);
      rec.node(x, { state: "done" });
    };

    const root = resolveNode(g, params.start);
    const order = [root, ...ids.filter((v) => v !== root)];
    for (const v of order) if (!p.has(v)) dfs(v, null, true);
    ids.forEach((v) => articulations.has(v) && rec.node(v, { state: "path", color: undefined }));
    ids.forEach((v) => !articulations.has(v) && rec.node(v, { state: "default" }));
    rec.push(
      `Hotovo. Bloků: **${blockList.length}** (barvy). Artikulace: ${articulations.size ? `$${set([...articulations].sort())}$` : "žádné"} (červeně). ` +
        `Mosty: ${bridges.length ? bridges.map((i) => `${g.edges[i].from}${g.edges[i].to}`).join(", ") : "žádné"} (čárkovaně). ` +
        (blockList.length > 1 ? "Blokový graf (bloky + artikulace) je strom." : "Graf je 2-souvislý (nemá artikulaci)."),
      { tables: [table()] },
    );
    return rec.steps;
  },
};
