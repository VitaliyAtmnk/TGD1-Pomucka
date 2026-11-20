import { describe, expect, it } from "vitest";
import { ALGORITHMS } from "./algorithms";
import { maxFlow } from "./algorithms/flow";
import { mst } from "./algorithms/mst";
import { criticalPath, dijkstra, floyd } from "./algorithms/paths";
import { scc } from "./algorithms/structure";
import { PRESETS } from "./presets";

describe("algorithms", () => {
  it("every preset runs and produces steps", () => {
    for (const a of ALGORITHMS)
      for (const p of a.presets) {
        expect(a.validate?.(p.graph, p.params ?? {}) ?? null).toBeNull();
        const steps = a.run(p.graph, p.params ?? {});
        expect(steps.length).toBeGreaterThan(1);
      }
  });

  it("max flow of the lecture example is 4", () => {
    const steps = maxFlow.run(PRESETS.flow, { source: "z", sink: "s", mode: "bfs" });
    expect(steps.at(-1)!.message).toContain("**4**");
  });

  it("naive counterexample reaches 2 thanks to backward edges", () => {
    const steps = maxFlow.run(PRESETS.flowNaive, { source: "z", sink: "s", mode: "dfs" });
    expect(steps.at(-1)!.info?.find((i) => i.label === "|x|")?.value).toBe("2");
  });

  it("floyd matches the lecture notes D5", () => {
    const last = floyd.run(PRESETS.floyd, {}).at(-1)!;
    expect(last.tables![0].rows).toEqual([
      ["0", "4", "7", "14", "11"],
      ["10", "0", "3", "10", "7"],
      ["7", "11", "0", "7", "4"],
      ["6", "10", "13", "0", "3"],
      ["3", "7", "10", "3", "0"],
    ]);
  });

  it("kruskal and jarnik agree", () => {
    const k = mst.run(PRESETS.weighted, { mode: "kruskal" }).at(-1)!.message;
    const j = mst.run(PRESETS.weighted, { mode: "jarnik", start: "4" }).at(-1)!.message;
    const w = (s: string) => s.match(/\*\*(\d+)\*\*/)![1];
    expect(w(k)).toBe(w(j));
    expect(w(k)).toBe("18");
  });

  it("dijkstra distances", () => {
    const last = dijkstra.run(PRESETS.weighted, { start: "1" }).at(-1)!;
    expect(last.tables![0].rows[0]).toEqual(["0", "7", "3", "9", "13", "14", "15"]);
  });

  it("critical path length", () => {
    expect(criticalPath.run(PRESETS.dag, { from: "1", to: "7" }).at(-1)!.message).toContain("**16**");
  });

  it("scc finds 3 components", () => {
    expect(scc.run(PRESETS.scc, {}).at(-1)!.message).toContain("3 kvazikomponent");
  });
});
