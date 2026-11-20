import type { AlgorithmDef } from "../types";
import { adjacency, cmpId, Recorder, set, sortedIds } from "./common";
import { PRESETS } from "../presets";

const NODE_LIMIT = 300;

export const vertexCoverFpt: AlgorithmDef = {
  id: "vertex-cover-fpt",
  title: "Vrcholové pokrytí velikosti k (FPT)",
  short: "FPT pokrytí",
  description:
    "Problém k-COV (existuje pokrytí s nejvýše $k$ uzly?) je NP-úplný, ale pro malé $k$ ho vyřešíme rychle. Každá hrana $uv$ musí mít v pokrytí aspoň jeden konec, " +
    "takže **větvíme**: buď vezmeme $u$, nebo $v$, a pokračujeme s $k-1$. Strom hledání má hloubku nejvýše $k$, tedy nejvýše $2^k$ listů: čas $O(2^k (n+m))$ – " +
    "exponenciální jen v parametru, ne ve velikosti grafu. **Bussova kernelizace** předem vezme každý uzel stupně $> k$ (jinak by bylo nutné vzít všechny jeho sousedy) " +
    "a zbylá instance má nejvýše $k^2$ hran, jinak je odpověď NE.",
  graphKind: "undirected",
  weighted: false,
  params: [
    {
      key: "k",
      label: "Parametr k",
      type: "select",
      options: [1, 2, 3, 4, 5, 6].map((k) => ({ value: String(k), label: `k = ${k}` })),
      default: "3",
    },
    {
      key: "buss",
      label: "Kernelizace",
      type: "select",
      options: [
        { value: "no", label: "bez kernelizace" },
        { value: "yes", label: "nejdřív Bussova pravidla" },
      ],
      default: "no",
    },
  ],
  presets: [
    { name: "Malý graf, k = 3", graph: PRESETS.cover, params: { k: "3", buss: "no" } },
    { name: "Hvězda s ocasy, Buss, k = 3 (nestačí)", graph: PRESETS.starPaths, params: { k: "3", buss: "yes" } },
    { name: "Hvězda s ocasy, Buss, k = 5", graph: PRESETS.starPaths, params: { k: "5", buss: "yes" } },
    { name: "Petersenův graf, k = 5 (nestačí)", graph: PRESETS.petersen, params: { k: "5", buss: "no" } },
  ],
  pseudocode: [
    "(Buss) uzel stupně > k dej do pokrytí, k := k − 1; izolované uzly vynech",
    "(Buss) zbývá-li víc než k² hran → odpověď NE",
    "COV(G, k): nemá-li G hrany → ANO",
    "  je-li k = 0 → NE (v této větvi)",
    "  vyber nepokrytou hranu uv; zkus COV(G − u, k − 1), pak COV(G − v, k − 1)",
  ],
  validate: (g) => (g.directed ? "Vizualizace pracuje s neorientovaným grafem." : null),
  run(g, params) {
    let k = Number(params.k ?? 3);
    const ids = sortedIds(g);
    const adj = adjacency(g);
    const rec = new Recorder();
    const forced: string[] = [];
    const removed = new Set<string>();
    let treeNodes = 0;

    const liveEdges = (gone: Set<string>) => g.edges.map((e, i) => ({ e, i })).filter(({ e }) => !gone.has(e.from) && !gone.has(e.to));
    const paint = (cover: string[], focus?: number) => {
      ids.forEach((v) => rec.node(v, { state: cover.includes(v) ? "done" : "default" }));
      g.edges.forEach((e, i) =>
        rec.edge(i, { state: i === focus ? "active" : cover.includes(e.from) || cover.includes(e.to) ? "dim" : "default" }),
      );
    };

    rec.push(`Hledáme pokrytí s nejvýše $k = ${k}$ uzly v grafu s ${ids.length} uzly a ${g.edges.length} hranami.`, { line: 2 });

    if (params.buss === "yes") {
      let again = true;
      while (again) {
        again = false;
        for (const v of ids) {
          if (removed.has(v)) continue;
          const d = adj.get(v)!.filter((a) => !removed.has(a.to)).length;
          if (d > k) {
            forced.push(v);
            removed.add(v);
            k--;
            paint(forced);
            rec.push(`Uzel **${v}** má stupeň ${d} > k: kdyby v pokrytí nebyl, musely by tam být všechny jeho sousedy. Vezmeme ho, $k := ${k}$.`, {
              line: 0,
            });
            again = true;
            if (k < 0) break;
          }
        }
        if (k < 0) break;
      }
      const rest = liveEdges(removed).length;
      if (k < 0 || rest > k * k) {
        rec.push(
          k < 0
            ? "Vynucených uzlů je víc než původní $k$ → odpověď **NE**."
            : `Po kernelizaci zbývá ${rest} hran $> k^2 = ${k * k}$. Každý uzel teď pokryje nejvýše $k$ hran, $k$ uzlů tedy nejvýše $k^2$ → odpověď **NE**.`,
          { line: 1 },
        );
        return rec.steps;
      }
      rec.push(`Jádro instance: ${rest} hran $\\le k^2 = ${k * k}$, zbývá parametr $k = ${k}$. Na jádru spustíme strom hledání.`, { line: 1 });
    }

    const search = (cover: string[], budget: number, depth: number, path: string): string[] | null => {
      treeNodes++;
      if (treeNodes > NODE_LIMIT) return null;
      const gone = new Set([...removed, ...cover]);
      const live = liveEdges(gone);
      const label = path || "kořen";
      if (live.length === 0) {
        paint([...forced, ...cover]);
        rec.push(`Větev ${label}: všechny hrany jsou pokryté → **ANO**.`, { line: 2, info: [{ label: "Hloubka", value: String(depth) }] });
        return cover;
      }
      if (budget === 0) {
        paint([...forced, ...cover], live[0].i);
        rec.push(`Větev ${label}: došel rozpočet, ale hrana ${live[0].e.from}${live[0].e.to} je nepokrytá → slepá větev.`, {
          line: 3,
          info: [{ label: "Hloubka", value: String(depth) }],
        });
        return null;
      }
      const { e, i } = live[0];
      paint([...forced, ...cover], i);
      rec.push(`Větev ${label}: nepokrytá hrana **${e.from}${e.to}** → větvíme na „+${e.from}“ a „+${e.to}“ (zbývá $k = ${budget}$).`, {
        line: 4,
        info: [{ label: "Hloubka", value: String(depth) }, { label: "Uzlů stromu", value: String(treeNodes) }],
      });
      for (const v of [e.from, e.to]) {
        const r = search([...cover, v], budget - 1, depth + 1, `${path}${path ? " → " : ""}+${v}`);
        if (r) return r;
      }
      return null;
    };
    const result = search([], k, 0, "");
    if (result) {
      const all = [...forced, ...result].sort(cmpId);
      paint(all);
      rec.push(`Pokrytí $${set(all)}$ s ${all.length} uzly (modře). Strom hledání měl ${treeNodes} uzlů; horní mez je $2^{k+1} - 1 = ${2 ** (k + 1) - 1}$.`, {
        line: 2,
      });
    } else if (treeNodes > NODE_LIMIT) {
      rec.push(`Zastaveno po ${NODE_LIMIT} uzlech stromu hledání.`, { line: 4 });
    } else {
      ids.forEach((v) => rec.node(v, { state: forced.includes(v) ? "done" : "default" }));
      rec.push(`Všechny větve skončily slepě (${treeNodes} uzlů stromu) → pokrytí s nejvýše ${params.k} uzly **neexistuje**.`, { line: 3 });
    }
    return rec.steps;
  },
};
