/**
 * Graph properties used by concept illustrations: each check returns a verdict and,
 * where possible, a witness (the cycle, the uncovered edge, the odd vertices…) to draw.
 */
import type { EdgeStyle, Graph, NodeStyle } from "./types";
import { adjacency, cmpId, sortedIds, strongComponents } from "./algorithms/common";

export type Selection = "none" | "nodes" | "edges" | "colors";

export interface PropertyInput {
  set: Set<string>; // selected nodes
  edgeSet: Set<number>; // selected edge indices
  colors: Map<string, number>; // node colours
}

export interface PropertyResult {
  ok: boolean;
  text: string; // Markdown + KaTeX, one sentence
  nodes?: Record<string, NodeStyle>;
  edges?: Record<number, EdgeStyle>;
}

export interface PropertyDef {
  label: string; // "acyklický"
  question: string; // shown in the badge: "Je graf acyklický?"
  selection: Selection;
  check: (g: Graph, input: PropertyInput) => PropertyResult;
}

/** Display name of a node: its label (e.g. "¬x1") if it has one, otherwise the id. Safe inside KaTeX. */
function nm(g: Graph, v: string) {
  return g.nodes.find((n) => n.id === v)?.label ?? v;
}
const texName = (g: Graph, v: string) => nm(g, v).replace(/¬/g, "\\neg ");
const fmtSet = (xs: Iterable<string>, g?: Graph) =>
  `\\{${[...xs].sort(cmpId).map((v) => (g ? texName(g, v) : v)).join(", ")}\\}`;
const edgeName = (g: Graph, i: number) => `${nm(g, g.edges[i].from)}${g.directed ? "→" : "–"}${nm(g, g.edges[i].to)}`;
const path = (g: Graph, vs: string[], directed = g.directed) => vs.map((v) => nm(g, v)).join(directed ? " → " : " – ");

function edgeIndex(g: Graph, a: string, b: string): number {
  return g.edges.findIndex((e) => (e.from === a && e.to === b) || (!g.directed && e.from === b && e.to === a));
}

/** Finds a cycle; returns the vertex sequence (first vertex repeated at the end) or null. */
export function findCycle(g: Graph): string[] | null {
  const adj = adjacency(g);
  const state = new Map<string, 0 | 1 | 2>();
  const parent = new Map<string, { v: string; edge: number }>();
  let found: string[] | null = null;
  const dfs = (v: string, viaEdge: number): void => {
    state.set(v, 1);
    for (const a of adj.get(v)!) {
      if (found) return;
      if (!g.directed && a.edge === viaEdge) continue;
      const st = state.get(a.to) ?? 0;
      if (st === 0) {
        parent.set(a.to, { v, edge: a.edge });
        dfs(a.to, a.edge);
      } else if (st === 1) {
        const cyc = [a.to];
        let cur = v;
        while (cur !== a.to) {
          cyc.push(cur);
          cur = parent.get(cur)!.v;
        }
        cyc.push(a.to);
        found = cyc.reverse();
        return;
      }
    }
    state.set(v, 2);
  };
  for (const v of sortedIds(g)) if (!state.get(v) && !found) dfs(v, -1);
  if (!found) {
    // self loops
    const loop = g.edges.find((e) => e.from === e.to);
    if (loop) return [loop.from, loop.from];
  }
  return found;
}

function cycleStyle(g: Graph, cyc: string[]): Pick<PropertyResult, "nodes" | "edges"> {
  const nodes: Record<string, NodeStyle> = {};
  const edges: Record<number, EdgeStyle> = {};
  cyc.forEach((v) => (nodes[v] = { state: "path" }));
  for (let i = 0; i + 1 < cyc.length; i++) {
    const k = edgeIndex(g, cyc[i], cyc[i + 1]);
    if (k >= 0) edges[k] = { state: "path" };
  }
  return { nodes, edges };
}

/** Components of the underlying undirected graph (weak components for digraphs). */
export function components(g: Graph, removedNodes = new Set<string>(), removedEdges = new Set<number>()): string[][] {
  const und: Graph = {
    directed: false,
    nodes: g.nodes.filter((n) => !removedNodes.has(n.id)),
    edges: g.edges.filter((e, i) => !removedEdges.has(i) && !removedNodes.has(e.from) && !removedNodes.has(e.to)),
  };
  const adj = adjacency(und);
  const seen = new Set<string>();
  const out: string[][] = [];
  for (const s of sortedIds(und)) {
    if (seen.has(s)) continue;
    const comp = [s];
    seen.add(s);
    for (let i = 0; i < comp.length; i++)
      for (const a of adj.get(comp[i])!)
        if (!seen.has(a.to)) {
          seen.add(a.to);
          comp.push(a.to);
        }
    out.push(comp.sort(cmpId));
  }
  return out;
}

function colorComponents(comps: string[][]): Record<string, NodeStyle> {
  const nodes: Record<string, NodeStyle> = {};
  comps.forEach((c, k) => c.forEach((v) => (nodes[v] = { color: k })));
  return nodes;
}

function degrees(g: Graph) {
  const d = new Map(g.nodes.map((n) => [n.id, 0]));
  g.edges.forEach((e) => {
    d.set(e.from, d.get(e.from)! + 1);
    d.set(e.to, d.get(e.to)! + 1);
  });
  return d;
}

function neighbours(g: Graph, v: string): Set<string> {
  const out = new Set<string>();
  g.edges.forEach((e) => {
    if (e.from === v) out.add(e.to);
    if (e.to === v && !g.directed) out.add(e.from);
  });
  return out;
}

function hamiltonCycle(g: Graph): string[] | null {
  const ids = sortedIds(g);
  const n = ids.length;
  if (n < 3 || n > 11) return null;
  const nb = new Map(ids.map((v) => [v, neighbours(g, v)]));
  const path = [ids[0]];
  const used = new Set(path);
  const bt = (): boolean => {
    if (path.length === n) return nb.get(path[n - 1])!.has(ids[0]);
    for (const w of [...nb.get(path[path.length - 1])!].sort(cmpId)) {
      if (used.has(w)) continue;
      path.push(w);
      used.add(w);
      if (bt()) return true;
      path.pop();
      used.delete(w);
    }
    return false;
  };
  return bt() ? [...path, ids[0]] : null;
}

const sel = (set: Set<string>, state: NodeStyle["state"] = "done") =>
  Object.fromEntries([...set].map((v) => [v, { state }])) as Record<string, NodeStyle>;

export const PROPERTIES: Record<string, PropertyDef> = {
  acyclic: {
    label: "acyklický",
    question: "Je graf acyklický?",
    selection: "none",
    check(g) {
      const c = findCycle(g);
      if (!c) return { ok: true, text: g.directed ? "Graf neobsahuje žádný cyklus – je **acyklický**." : "Graf neobsahuje kružnici." };
      return {
        ok: false,
        text: `${g.directed ? "Cyklus" : "Kružnice"} ${path(g, c)} – graf **není** acyklický.`,
        ...cycleStyle(g, c),
      };
    },
  },
  connected: {
    label: "souvislý",
    question: "Je graf souvislý?",
    selection: "none",
    check(g) {
      const comps = components(g);
      if (comps.length <= 1) return { ok: true, text: `Mezi každými dvěma uzly vede cesta – graf je **souvislý**${g.directed ? " (slabě)" : ""}.` };
      return {
        ok: false,
        text: `Graf má ${comps.length} komponenty: ${comps.map((c) => `$${fmtSet(c, g)}$`).join(", ")} – **není** souvislý.`,
        nodes: colorComponents(comps),
      };
    },
  },
  "strongly-connected": {
    label: "silně souvislý",
    question: "Je graf silně souvislý?",
    selection: "none",
    check(g) {
      const { comps } = strongComponents(g);
      if (comps.length <= 1) return { ok: true, text: "Z každého uzlu vede orientovaná cesta do každého – graf je **silně souvislý**." };
      return {
        ok: false,
        text: `Kvazikomponenty: ${comps.map((c) => `$${fmtSet(c, g)}$`).join(", ")} – graf **není** silně souvislý.`,
        nodes: colorComponents(comps),
      };
    },
  },
  tree: {
    label: "strom",
    question: "Je graf strom?",
    selection: "none",
    check(g) {
      const comps = components(g);
      const c = findCycle({ ...g, directed: false });
      const n = g.nodes.length;
      const m = g.edges.length;
      if (comps.length === 1 && !c) return { ok: true, text: `Souvislý a bez kružnic ($m = ${m} = n - 1$) – graf **je strom**.` };
      if (c) return { ok: false, text: `Kružnice ${path(g, c, false)} – **není** strom ($m = ${m}$, $n - 1 = ${n - 1}$).`, ...cycleStyle(g, c) };
      return { ok: false, text: `Graf je nesouvislý (${comps.length} komponenty) – je to les, **ne** strom.`, nodes: colorComponents(comps) };
    },
  },
  bipartite: {
    label: "bipartitní",
    question: "Je graf bipartitní (2-obarvitelný)?",
    selection: "none",
    check(g) {
      const und = { ...g, directed: false };
      const adj = adjacency(und);
      const color = new Map<string, number>();
      const parent = new Map<string, string>();
      for (const s of sortedIds(g)) {
        if (color.has(s)) continue;
        color.set(s, 0);
        const q = [s];
        while (q.length) {
          const v = q.shift()!;
          for (const a of adj.get(v)!) {
            if (!color.has(a.to)) {
              color.set(a.to, 1 - color.get(v)!);
              parent.set(a.to, v);
              q.push(a.to);
            } else if (color.get(a.to) === color.get(v)) {
              // odd cycle: paths to the common ancestor
              const up = (x: string) => {
                const p = [x];
                while (parent.has(p[p.length - 1])) p.push(parent.get(p[p.length - 1])!);
                return p;
              };
              const pa = up(v);
              const pb = up(a.to);
              const anc = pa.find((x) => pb.includes(x))!;
              const cyc = [...pa.slice(0, pa.indexOf(anc) + 1), ...pb.slice(0, pb.indexOf(anc)).reverse(), v];
              return { ok: false, text: `Lichá kružnice ${path(g, cyc, false)} – graf **není** bipartitní.`, ...cycleStyle(und, cyc) };
            }
          }
        }
      }
      const nodes: Record<string, NodeStyle> = {};
      color.forEach((c, v) => (nodes[v] = { color: c }));
      return { ok: true, text: "Uzly lze rozdělit do dvou tříd bez hran uvnitř – graf **je** bipartitní.", nodes };
    },
  },
  eulerian: {
    label: "eulerovský",
    question: "Je graf eulerovský?",
    selection: "none",
    check(g) {
      const d = degrees(g);
      const odd = sortedIds(g).filter((v) => d.get(v)! % 2 === 1);
      const comps = components(g).filter((c) => c.some((v) => d.get(v)! > 0));
      if (comps.length > 1) return { ok: false, text: "Hrany neleží v jedné komponentě – graf **není** eulerovský.", nodes: colorComponents(comps) };
      if (odd.length)
        return {
          ok: false,
          text: `Uzly lichého stupně: ${fmtSet(odd, g)}$ – graf **není** eulerovský${odd.length === 2 ? " (existuje jen otevřený eulerovský tah)" : ""}.`,
          nodes: sel(new Set(odd), "path"),
        };
      return { ok: true, text: "Souvislý a všechny stupně jsou sudé – graf **je** eulerovský." };
    },
  },
  hamiltonian: {
    label: "hamiltonovský",
    question: "Je graf hamiltonovský?",
    selection: "none",
    check(g) {
      if (g.nodes.length > 11) return { ok: false, text: "Pro víc než 11 uzlů se hamiltonovskost nepočítá (exponenciální úloha)." };
      const c = hamiltonCycle({ ...g, directed: false });
      if (c) return { ok: true, text: `Hamiltonovská kružnice ${path(g, c, false)}.`, ...cycleStyle({ ...g, directed: false }, c) };
      return { ok: false, text: "Žádná kružnice neprochází všemi uzly – graf **není** hamiltonovský (ověřeno prohledáním)." };
    },
  },
  complete: {
    label: "úplný",
    question: "Je graf úplný?",
    selection: "none",
    check(g) {
      const ids = sortedIds(g);
      for (let i = 0; i < ids.length; i++)
        for (let j = i + 1; j < ids.length; j++)
          if (edgeIndex({ ...g, directed: false }, ids[i], ids[j]) < 0)
            return { ok: false, text: `Uzly ${nm(g, ids[i])} a ${nm(g, ids[j])} nejsou spojené – graf **není** úplný.`, nodes: sel(new Set([ids[i], ids[j]]), "path") };
      return { ok: true, text: `Každé dva uzly jsou spojené – graf je $K_{${ids.length}}$.` };
    },
  },
  "independent-set": {
    label: "nezávislá množina",
    question: "Jsou vybrané uzly nezávislá množina?",
    selection: "nodes",
    check(g, { set }) {
      const bad = g.edges.findIndex((e) => set.has(e.from) && set.has(e.to));
      if (bad >= 0)
        return {
          ok: false,
          text: `Hrana ${edgeName(g, bad)} spojuje dva vybrané uzly – množina **není** nezávislá.`,
          nodes: sel(set),
          edges: { [bad]: { state: "path" } },
        };
      return { ok: true, text: `Mezi vybranými uzly ${fmtSet(set, g)}$ není žádná hrana – množina **je** nezávislá (velikost ${set.size}).`, nodes: sel(set) };
    },
  },
  "vertex-cover": {
    label: "pokrytí",
    question: "Pokrývají vybrané uzly všechny hrany?",
    selection: "nodes",
    check(g, { set }) {
      const bad = g.edges.findIndex((e) => !set.has(e.from) && !set.has(e.to));
      if (bad >= 0)
        return {
          ok: false,
          text: `Hrana ${edgeName(g, bad)} nemá vybraný ani jeden konec – množina **není** pokrytí.`,
          nodes: sel(set),
          edges: { [bad]: { state: "path" } },
        };
      return { ok: true, text: `Každá hrana má aspoň jeden konec ve vybrané množině – **je** to pokrytí velikosti ${set.size}.`, nodes: sel(set) };
    },
  },
  clique: {
    label: "klika",
    question: "Tvoří vybrané uzly kliku?",
    selection: "nodes",
    check(g, { set }) {
      const xs = [...set].sort(cmpId);
      for (let i = 0; i < xs.length; i++)
        for (let j = i + 1; j < xs.length; j++)
          if (edgeIndex({ ...g, directed: false }, xs[i], xs[j]) < 0)
            return { ok: false, text: `Vybrané uzly ${nm(g, xs[i])} a ${nm(g, xs[j])} nejsou sousední – **není** to klika.`, nodes: { ...sel(set), [xs[i]]: { state: "path" }, [xs[j]]: { state: "path" } } };
      return { ok: true, text: `Každé dva vybrané uzly sousedí – ${fmtSet(set, g)}$ **je** klika velikosti ${set.size}.`, nodes: sel(set) };
    },
  },
  "dominating-set": {
    label: "dominantní množina",
    question: "Je vybraná množina dominantní?",
    selection: "nodes",
    check(g, { set }) {
      const bad = sortedIds(g).find((v) => !set.has(v) && ![...neighbours(g, v)].some((w) => set.has(w)));
      if (bad)
        return {
          ok: false,
          text: `Uzel ${nm(g, bad)} není v množině a ${g.directed ? "nevede z něj hrana" : "nesousedí s žádným uzlem"} do množiny – **není** dominantní.`,
          nodes: { ...sel(set), [bad]: { state: "path" } },
        };
      return { ok: true, text: `Každý uzel mimo množinu ${g.directed ? "má hranu do" : "sousedí s"} některým vybraným uzlem – množina **je** dominantní.`, nodes: sel(set) };
    },
  },
  kernel: {
    label: "jádro",
    question: "Je vybraná množina jádro?",
    selection: "nodes",
    check(g, input) {
      const ind = PROPERTIES["independent-set"].check(g, input);
      if (!ind.ok) return { ...ind, text: ind.text.replace("**není** nezávislá", "**není** nezávislá, tedy ani jádro") };
      const dom = PROPERTIES["dominating-set"].check(g, input);
      if (!dom.ok) return { ...dom, text: dom.text.replace("**není** dominantní", "**není** dominantní, tedy ani jádro") };
      return { ok: true, text: `Množina ${fmtSet(input.set, g)}$ je nezávislá i dominantní – **je** to jádro.`, nodes: sel(input.set) };
    },
  },
  "separating-set": {
    label: "uzlový řez",
    question: "Rozpojí odebrání vybraných uzlů graf?",
    selection: "nodes",
    check(g, { set }) {
      const comps = components(g, set);
      const nodes = { ...colorComponents(comps), ...sel(set, "rejected") };
      if (comps.length > 1)
        return { ok: true, text: `Po odebrání ${fmtSet(set, g)}$ se graf rozpadne na ${comps.length} komponenty – **je** to uzlový řez${set.size === 1 ? " (vybraný uzel je artikulace)" : ""}.`, nodes };
      return { ok: false, text: set.size ? `Po odebrání ${fmtSet(set, g)}$ zůstane graf souvislý – **není** to uzlový řez.` : "Vyber uzly k odebrání.", nodes };
    },
  },
  "disconnecting-edges": {
    label: "hranový řez",
    question: "Rozpojí odebrání vybraných hran graf?",
    selection: "edges",
    check(g, { edgeSet }) {
      const comps = components(g, new Set(), edgeSet);
      const edges = Object.fromEntries([...edgeSet].map((i) => [i, { state: "cut" as const }]));
      if (comps.length > components(g).length)
        return {
          ok: true,
          text: `Po odebrání ${edgeSet.size} ${edgeSet.size === 1 ? "hrany (most)" : "hran"} se graf rozpadne na ${comps.length} komponenty – **je** to hranový řez.`,
          nodes: colorComponents(comps),
          edges,
        };
      return { ok: false, text: edgeSet.size ? "Graf zůstane souvislý – **není** to hranový řez." : "Vyber hrany k odebrání.", edges };
    },
  },
  "spanning-tree": {
    label: "kostra",
    question: "Tvoří vybrané hrany kostru?",
    selection: "edges",
    check(g, { edgeSet }) {
      const sub: Graph = { ...g, directed: false, edges: g.edges.filter((_, i) => edgeSet.has(i)) };
      const edges = Object.fromEntries([...edgeSet].map((i) => [i, { state: "tree" as const }]));
      const c = findCycle(sub);
      if (c) {
        const cs = cycleStyle(sub, c);
        const mapped: Record<number, EdgeStyle> = { ...edges };
        Object.keys(cs.edges ?? {}).forEach((k) => {
          const e = sub.edges[Number(k)];
          mapped[g.edges.indexOf(e)] = { state: "path" };
        });
        return { ok: false, text: `Vybrané hrany obsahují kružnici ${path(g, c, false)} – **není** to kostra.`, edges: mapped, nodes: cs.nodes };
      }
      const comps = components(sub);
      if (comps.length > 1)
        return { ok: false, text: `Vybrané hrany nespojují všechny uzly (${comps.length} komponenty) – **není** to kostra.`, edges, nodes: colorComponents(comps) };
      return { ok: true, text: `Vybraných ${edgeSet.size} hran tvoří strom na všech uzlech – **je** to kostra ($n-1 = ${g.nodes.length - 1}$ hran).`, edges };
    },
  },
  matching: {
    label: "párování",
    question: "Tvoří vybrané hrany párování?",
    selection: "edges",
    check(g, { edgeSet }) {
      const edges = Object.fromEntries([...edgeSet].map((i) => [i, { state: "tree" as const }]));
      const seen = new Map<string, number>();
      for (const i of edgeSet)
        for (const v of [g.edges[i].from, g.edges[i].to]) {
          if (seen.has(v))
            return { ok: false, text: `Uzel ${nm(g, v)} je koncem dvou vybraných hran – **není** to párování.`, edges: { ...edges, [i]: { state: "path" }, [seen.get(v)!]: { state: "path" } }, nodes: { [v]: { state: "path" } } };
          seen.set(v, i);
        }
      const perfect = seen.size === g.nodes.length;
      return {
        ok: true,
        text: `Žádné dvě vybrané hrany nesdílejí uzel – **je** to párování s ${edgeSet.size} hranami${perfect ? ", a dokonce **perfektní**" : ""}.`,
        edges,
        nodes: Object.fromEntries([...seen.keys()].map((v) => [v, { state: "done" as const }])),
      };
    },
  },
  "proper-coloring": {
    label: "obarvení",
    question: "Je obarvení korektní?",
    selection: "colors",
    check(g, { colors }) {
      const nodes: Record<string, NodeStyle> = {};
      colors.forEach((c, v) => (nodes[v] = { color: c }));
      const uncolored = sortedIds(g).filter((v) => !colors.has(v));
      const bad = g.edges.findIndex((e) => colors.has(e.from) && colors.get(e.from) === colors.get(e.to));
      if (bad >= 0) return { ok: false, text: `Sousední uzly ${nm(g, g.edges[bad].from)} a ${nm(g, g.edges[bad].to)} mají stejnou barvu – obarvení **není** korektní.`, nodes, edges: { [bad]: { state: "path" } } };
      if (uncolored.length) return { ok: false, text: `Neobarvené uzly: ${fmtSet(uncolored, g)}$.`, nodes };
      const k = new Set(colors.values()).size;
      return { ok: true, text: `Sousední uzly mají různé barvy – korektní obarvení **${k}** barvami, tedy $\\chi(G) \\le ${k}$.`, nodes };
    },
  },
};

export const PROPERTY_IDS = Object.keys(PROPERTIES);
