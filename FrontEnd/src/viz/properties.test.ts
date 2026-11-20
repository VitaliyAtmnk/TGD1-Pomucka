import { describe, expect, it } from "vitest";
import { PRESETS } from "./presets";
import { findCycle, PROPERTIES, type PropertyInput } from "./properties";
import type { Graph } from "./types";

const none: PropertyInput = { set: new Set(), edgeSet: new Set(), colors: new Map() };
const withSet = (...ids: string[]): PropertyInput => ({ ...none, set: new Set(ids) });
const check = (p: string, g: Graph, input = none) => PROPERTIES[p].check(g, input);

describe("graph properties", () => {
  it("acyclic finds directed cycles", () => {
    expect(check("acyclic", PRESETS.dag).ok).toBe(true);
    const cyc = { ...PRESETS.dag, edges: [...PRESETS.dag.edges, { from: "7", to: "1" }] };
    const r = check("acyclic", cyc);
    expect(r.ok).toBe(false);
    const c = findCycle(cyc)!;
    expect(c[0]).toBe(c[c.length - 1]);
  });

  it("undirected cycles and trees", () => {
    expect(check("tree", PRESETS.tree).ok).toBe(true);
    expect(check("acyclic", PRESETS.tree).ok).toBe(true);
    expect(check("tree", PRESETS.k5).ok).toBe(false);
    expect(check("tree", PRESETS.twoComponents).ok).toBe(false);
  });

  it("connectivity", () => {
    expect(check("connected", PRESETS.twoComponents).ok).toBe(false);
    expect(check("connected", PRESETS.petersen).ok).toBe(true);
    expect(check("strongly-connected", PRESETS.scc).ok).toBe(false);
  });

  it("bipartite, eulerian, hamiltonian, complete", () => {
    expect(check("bipartite", PRESETS.cube).ok).toBe(true);
    const odd = check("bipartite", PRESETS.petersen);
    expect(odd.ok).toBe(false);
    expect(odd.text).toMatch(/Lichá kružnice/);
    expect(check("eulerian", PRESETS.k5).ok).toBe(true);
    expect(check("eulerian", PRESETS.house).ok).toBe(false);
    expect(check("hamiltonian", PRESETS.cube).ok).toBe(true);
    expect(check("hamiltonian", PRESETS.petersen).ok).toBe(false);
    expect(check("complete", PRESETS.k5).ok).toBe(true);
  });

  it("set properties", () => {
    const P = PRESETS.petersen;
    expect(check("independent-set", P, withSet("1", "3", "9", "10")).ok).toBe(true);
    expect(check("independent-set", P, withSet("1", "2")).ok).toBe(false);
    expect(check("vertex-cover", PRESETS.star, withSet("s")).ok).toBe(true);
    expect(check("clique", PRESETS.k5, withSet("1", "2", "3")).ok).toBe(true);
    expect(check("dominating-set", PRESETS.star, withSet("s")).ok).toBe(true);
    expect(check("kernel", PRESETS.star, withSet("1", "2", "3", "4", "5")).ok).toBe(true);
    expect(check("separating-set", PRESETS.star, withSet("s")).ok).toBe(true);
  });

  it("edge-set properties and colouring", () => {
    const t = PRESETS.tree;
    const all = new Set(t.edges.map((_, i) => i));
    expect(check("spanning-tree", t, { ...none, edgeSet: all }).ok).toBe(true);
    expect(check("disconnecting-edges", t, { ...none, edgeSet: new Set([0]) }).ok).toBe(true);
    expect(check("matching", t, { ...none, edgeSet: new Set([0, 1]) }).ok).toBe(false);
    const colors = new Map([["s", 0], ["1", 1], ["2", 1], ["3", 1], ["4", 1], ["5", 1]]);
    expect(check("proper-coloring", PRESETS.star, { ...none, colors }).ok).toBe(true);
    colors.set("1", 0);
    expect(check("proper-coloring", PRESETS.star, { ...none, colors }).ok).toBe(false);
  });
});
