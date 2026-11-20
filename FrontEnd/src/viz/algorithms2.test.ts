import { describe, expect, it } from "vitest";
import { blocks } from "./algorithms/blocks";
import { parseCnf } from "./algorithms/common";
import { euler } from "./algorithms/euler";
import { vertexCoverFpt } from "./algorithms/fpt";
import { bondyChvatal, hamiltonBacktracking } from "./algorithms/hamilton";
import { independentSet, kernel } from "./algorithms/kernel";
import { bipartiteMatching } from "./algorithms/matching";
import { matrixReducibility } from "./algorithms/matrix";
import { reduction3satInd, twoSat } from "./algorithms/sat";
import { PRESETS } from "./presets";
import type { Graph } from "./types";

const EMPTY: Graph = { directed: true, nodes: [], edges: [] };

function satisfiable(formula: string) {
  const parsed = parseCnf(formula);
  if ("error" in parsed) throw new Error(parsed.error);
  for (let m = 0; m < 1 << parsed.vars.length; m++) {
    const val = new Map(parsed.vars.map((v, i) => [v, ((m >> i) & 1) === 1]));
    if (parsed.clauses.every((c) => c.some((l) => val.get(l.v) !== l.neg))) return true;
  }
  return false;
}

describe("second batch of algorithms", () => {
  it("parses CNF formulas", () => {
    const r = parseCnf("(x1 ∨ ¬x2) ∧ (!x3 | x1) (x2, -x4)");
    if ("error" in r) throw new Error(r.error);
    expect(r.clauses).toHaveLength(3);
    expect(r.clauses[0][1]).toEqual({ v: "x2", neg: true });
    expect(r.vars).toEqual(["x1", "x2", "x3", "x4"]);
    expect("error" in parseCnf("x1 or x2")).toBe(true);
  });

  it("2-SAT detects satisfiable and unsatisfiable formulas", () => {
    const sat = twoSat.run(EMPTY, { formula: "(x1 ∨ x2) ∧ (¬x1 ∨ x3) ∧ (¬x2 ∨ ¬x3) ∧ (x2 ∨ ¬x3)" }).at(-1)!.message;
    expect(sat).toContain("**splnitelná**");
    const unsat = twoSat.run(EMPTY, { formula: "(x1 ∨ x2) ∧ (¬x1 ∨ x2) ∧ (x1 ∨ ¬x2) ∧ (¬x1 ∨ ¬x2)" }).at(-1)!.message;
    expect(unsat).toContain("**nesplnitelná**");
    expect(twoSat.validate!(EMPTY, { formula: "(x1 ∨ x2 ∨ x3)" })).toContain("3-SAT");
  });

  it("2-SAT agrees with brute force and its assignment satisfies the formula", () => {
    for (let t = 0; t < 80; t++) {
      const clauses = Array.from({ length: 5 }, () => {
        const a = 1 + Math.floor(Math.random() * 4);
        let b = 1 + Math.floor(Math.random() * 4);
        if (b === a) b = (a % 4) + 1;
        return `(${Math.random() < 0.5 ? "¬" : ""}x${a} ∨ ${Math.random() < 0.5 ? "¬" : ""}x${b})`;
      });
      const formula = clauses.join(" ∧ ");
      const last = twoSat.run(EMPTY, { formula }).at(-1)!;
      const expected = satisfiable(formula);
      expect(last.message.includes("**splnitelná**")).toBe(expected);
      if (expected) {
        const parsed = parseCnf(formula);
        if ("error" in parsed) throw new Error();
        const val = new Map(parsed.vars.map((v) => [v, last.nodes![v].state === "done"]));
        expect(parsed.clauses.every((c) => c.some((l) => val.get(l.v) !== l.neg))).toBe(true);
      }
    }
  });

  it("3-SAT → IND picks one non-conflicting literal per clause", () => {
    const formula = "(x1 ∨ x2 ∨ ¬x3) ∧ (¬x1 ∨ x2 ∨ x3) ∧ (x1 ∨ ¬x2 ∨ x3)";
    const g = reduction3satInd.displayGraph!(EMPTY, { formula });
    const last = reduction3satInd.run(EMPTY, { formula }).at(-1)!;
    const chosen = new Set(Object.entries(last.nodes!).filter(([, s]) => s.state === "done").map(([id]) => id));
    expect(chosen.size).toBe(3);
    for (const e of g.edges) expect(chosen.has(e.from) && chosen.has(e.to)).toBe(false);
    expect(g.nodes).toHaveLength(9);
  });

  it("Euler trail uses every edge exactly once", () => {
    for (const p of euler.presets) {
      expect(euler.validate!(p.graph, p.params ?? {})).toBeNull();
      const last = euler.run(p.graph, p.params ?? {}).at(-1)!.message;
      const trail = last.split(": ")[1].split(" (")[0].split(" → ");
      expect(trail).toHaveLength(p.graph.edges.length + 1);
    }
  });

  it("finds blocks, articulations and bridges", () => {
    const last = blocks.run(PRESETS.blocks, { start: "1" }).at(-1)!.message;
    expect(last).toContain("Bloků: **4**");
    expect(blocks.run(PRESETS.tree, { start: "1" }).at(-1)!.message).toContain("Bloků: **5**");
    expect(blocks.run(PRESETS.petersen, {}).at(-1)!.message).toContain("2-souvislý");
  });

  it("matching of the lecture bigraph is perfect", () => {
    expect(bipartiteMatching.run(PRESETS.bigraph, {}).at(-1)!.message).toContain("**perfektní**");
    expect(bipartiteMatching.run(PRESETS.bigraphDeficient, {}).at(-1)!.message).toContain("**2**");
  });

  it("kernel of a DAG is independent and dominating", () => {
    for (const graph of [PRESETS.dag, PRESETS.game]) {
      const last = kernel.run(graph, {}).at(-1)!;
      const K = new Set(Object.entries(last.nodes!).filter(([, s]) => s.state === "done").map(([id]) => id));
      for (const e of graph.edges) expect(K.has(e.from) && K.has(e.to)).toBe(false);
      for (const n of graph.nodes) if (!K.has(n.id)) expect(graph.edges.some((e) => e.from === n.id && K.has(e.to))).toBe(true);
    }
  });

  it("greedy vs exact independent set", () => {
    expect(independentSet.run(PRESETS.star, { mode: "greedy-max" }).at(-1)!.message).toContain("velikosti 1");
    expect(independentSet.run(PRESETS.star, { mode: "exact" }).at(-1)!.message).toContain("\\alpha(G) = 5");
    expect(independentSet.run(PRESETS.petersen, { mode: "exact" }).at(-1)!.message).toContain("\\alpha(G) = 4");
  });

  it("vertex cover FPT", () => {
    expect(vertexCoverFpt.run(PRESETS.petersen, { k: "5" }).at(-1)!.message).toContain("**neexistuje**");
    expect(vertexCoverFpt.run(PRESETS.petersen, { k: "6" }).at(-1)!.message).toContain("Pokrytí");
    expect(vertexCoverFpt.run(PRESETS.starPaths, { k: "3", buss: "yes" }).at(-1)!.message).toContain("**neexistuje**");
    expect(vertexCoverFpt.run(PRESETS.starPaths, { k: "5", buss: "yes" }).at(-1)!.message).toContain("Pokrytí");
  });

  it("matrix reducibility gives an upper block triangular form", () => {
    const m = "0 1 0 2 3 0; 0 0 0 0 0 4; 0 5 6 0 0 0; 7 0 0 0 8 0; 9 10 0 0 11 12; 0 13 0 0 0 14";
    const last = matrixReducibility.run(EMPTY, { matrix: m }).at(-1)!;
    expect(last.message).toContain("**rozložitelná**");
    const t = last.tables![0];
    const comp: Record<string, number> = {};
    [["1", "4", "5"], ["2", "6"], ["3"]].forEach((c, k) => c.forEach((v) => (comp[v] = k)));
    // every non-zero entry must be on or above the diagonal blocks: block index of row ≤ block index of column
    const pos = (v: string) => t.columns.indexOf(v);
    t.rows.forEach((row, a) =>
      row.forEach((val, b) => {
        if (val !== "0" && a !== b) {
          const blockOf = (i: number) => t.columns.slice(0, i + 1).filter((v, k, arr) => k === 0 || comp[v] !== comp[arr[k - 1]]).length;
          expect(blockOf(a)).toBeLessThanOrEqual(blockOf(b));
        }
      }),
    );
    void pos;
    expect(matrixReducibility.run(EMPTY, { matrix: "0 0 1 0; 0 0 0 3; 0 2 0 0; 4 0 0 0" }).at(-1)!.message).toContain("**nerozložitelná**");
  });

  it("hamilton backtracking and closure", () => {
    expect(hamiltonBacktracking.run(PRESETS.cube, { start: "1" }).at(-1)!.message).toContain("Hamiltonovská kružnice");
    expect(hamiltonBacktracking.run(PRESETS.petersen, { start: "1" }).at(-1)!.message).toMatch(/není hamiltonovský|Zastaveno/);
    expect(bondyChvatal.run(PRESETS.closureFull, {}).at(-1)!.message).toContain("**úplný graf**");
    expect(bondyChvatal.run(PRESETS.closurePartial, {}).at(-1)!.message).toContain("není úplný");
  });
});
