import type { AlgorithmDef } from "../types";
import { adjacency, Recorder, resolveNode, sortedIds } from "./common";
import { PRESETS } from "../presets";

export const euler: AlgorithmDef = {
  id: "euler",
  title: "Eulerovský tah (Hierholzerův algoritmus)",
  short: "Eulerovský tah",
  description:
    "Souvislý graf je eulerovský, právě když mají všechny uzly **sudý stupeň**; se dvěma uzly lichého stupně existuje otevřený eulerovský tah mezi nimi. " +
    "Hierholzerův algoritmus jde z uzlu po nepoužitých hranách, dokud neuvízne (to může jen ve výchozím uzlu), a pak do vzniklého uzavřeného tahu " +
    "**vkládá další uzavřené tahy** z uzlů, které ještě mají nepoužité hrany. Každou hranu projde jednou, složitost je $O(n+m)$.",
  graphKind: "undirected",
  weighted: false,
  params: [{ key: "start", label: "Počáteční uzel", type: "node", default: "first" }],
  presets: [
    { name: "Úplný graf K₅ (všechny stupně 4)", graph: PRESETS.k5, params: { start: "1" } },
    { name: "Domeček – otevřený tah", graph: PRESETS.house, params: { start: "1" } },
    { name: "Dva trojúhelníky a čtverec", graph: PRESETS.eulerMixed, params: { start: "a" } },
  ],
  pseudocode: [
    "Ověř: graf je souvislý a má 0 nebo 2 uzly lichého stupně",
    "Začni v uzlu lichého stupně (pokud existuje), jinak v libovolném",
    "Z aktuálního uzlu jdi po nepoužité hraně, dokud to jde",
    "Uvízneš-li, vrať se po tahu k uzlu s nepoužitou hranou",
    "  a vlož z něj další uzavřený tah",
    "Až jsou použity všechny hrany, tah je eulerovský",
  ],
  validate: (g) => {
    if (g.directed) return "Vizualizace pracuje s neorientovaným grafem.";
    if (!g.edges.length) return "Graf nemá žádné hrany.";
    const adj = adjacency(g);
    const odd = sortedIds(g).filter((v) => adj.get(v)!.length % 2 === 1);
    if (odd.length > 2)
      return `Uzly lichého stupně: ${odd.join(", ")}. Eulerovský tah neexistuje (lichých uzlů smí být nejvýše 2).`;
    // connectivity of the part with edges
    const withEdges = sortedIds(g).filter((v) => adj.get(v)!.length > 0);
    const seen = new Set([withEdges[0]]);
    const st = [withEdges[0]];
    while (st.length) for (const a of adj.get(st.pop()!)!) if (!seen.has(a.to)) seen.add(a.to), st.push(a.to);
    if (withEdges.some((v) => !seen.has(v))) return "Hrany neleží v jedné komponentě – eulerovský tah neexistuje.";
    return null;
  },
  run(g, params) {
    const adj = adjacency(g);
    const ids = sortedIds(g);
    const odd = ids.filter((v) => adj.get(v)!.length % 2 === 1);
    const start = odd.length === 2 ? (odd.includes(params.start) ? params.start : odd[0]) : resolveNode(g, params.start);
    const used = new Set<number>();
    const rec = new Recorder();
    ids.forEach((v) => rec.node(v, { label: `d=${adj.get(v)!.length}` }));
    rec.push(
      odd.length === 0
        ? `Všechny uzly mají sudý stupeň → hledáme **uzavřený** eulerovský tah. Začneme v uzlu **${start}**.`
        : `Uzly ${odd.join(" a ")} mají lichý stupeň → existuje jen **otevřený** eulerovský tah mezi nimi. Začneme v **${start}**.`,
      { line: odd.length ? 1 : 0 },
    );
    ids.forEach((v) => rec.node(v, { label: undefined }));

    // Hierholzer with an explicit stack; the final trail is read from the stack pops.
    const stack: { v: string; via: number | null }[] = [{ v: start, via: null }];
    const trail: { v: string; via: number | null }[] = [];
    let round = 1;
    rec.node(start, { state: "active" });
    while (stack.length) {
      const top = stack[stack.length - 1];
      const next = adj.get(top.v)!.find((a) => !used.has(a.edge));
      if (next) {
        used.add(next.edge);
        stack.push({ v: next.to, via: next.edge });
        rec.edge(next.edge, { state: "path", label: String(used.size) });
        rec.node(top.v, { state: "visited" }).node(next.to, { state: "active" });
        rec.push(`Jdeme po nepoužité hraně **${top.v}${next.to}** (${used.size}. použitá hrana).`, {
          line: 2,
          info: [{ label: "Rozpracovaný tah", value: stack.map((s) => s.v).join(" → ") }],
        });
      } else {
        const popped = stack.pop()!;
        trail.push(popped);
        rec.node(popped.v, { state: "done" });
        if (popped.via !== null) rec.edge(popped.via, { state: "tree" });
        const back = stack[stack.length - 1];
        const hasMore = back && adj.get(back.v)!.some((a) => !used.has(a.edge));
        rec.push(
          back
            ? `Z uzlu **${popped.v}** už nevede nepoužitá hrana → zapíšeme ho do výsledného tahu a vrátíme se do **${back.v}**.` +
                (hasMore ? ` Uzel **${back.v}** má ještě nepoužité hrany – odtud vložíme další uzavřený tah (${++round}. smyčka).` : "")
            : `Zásobník je prázdný – všechny hrany jsou použité.`,
          {
            line: hasMore ? 4 : 3,
            info: [
              { label: "Rozpracovaný tah", value: stack.map((s) => s.v).join(" → ") || "–" },
              { label: "Hotová část (od konce)", value: trail.map((s) => s.v).join(" ← ") },
            ],
          },
        );
        if (back) rec.node(back.v, { state: "active" });
      }
    }
    const order = trail.reverse().map((s) => s.v);
    rec.push(`Eulerovský tah: ${order.join(" → ")} (${g.edges.length} hran, každá právě jednou).`, { line: 5 });
    return rec.steps;
  },
};
