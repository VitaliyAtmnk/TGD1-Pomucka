import type { AlgorithmDef } from "../types";
import { blocks } from "./blocks";
import { euler } from "./euler";
import { maxFlow } from "./flow";
import { vertexCoverFpt } from "./fpt";
import { bondyChvatal, hamiltonBacktracking } from "./hamilton";
import { independentSet, kernel } from "./kernel";
import { bipartiteMatching } from "./matching";
import { matrixReducibility } from "./matrix";
import { mst } from "./mst";
import { criticalPath, dijkstra, floyd } from "./paths";
import { reduction3satInd, twoSat } from "./sat";
import { graphSearch } from "./search";
import { coloring, scc } from "./structure";

/** Grouped by the topic they belong to, in the order of the course. */
export const ALGORITHM_GROUPS: { title: string; items: AlgorithmDef[] }[] = [
  { title: "Základy a metrika", items: [mst, dijkstra, euler] },
  { title: "Orientované grafy", items: [scc, criticalPath] },
  { title: "Toky a matice", items: [maxFlow, floyd, matrixReducibility, bipartiteMatching] },
  { title: "Souvislost a prohledávání", items: [graphSearch, blocks, hamiltonBacktracking, bondyChvatal] },
  { title: "Nezávislost, jádro, barvení", items: [independentSet, kernel, coloring] },
  { title: "Složitost", items: [twoSat, reduction3satInd, vertexCoverFpt] },
];

export const ALGORITHMS: AlgorithmDef[] = ALGORITHM_GROUPS.flatMap((g) => g.items);

export const ALGORITHM_BY_ID: Record<string, AlgorithmDef> = Object.fromEntries(ALGORITHMS.map((a) => [a.id, a]));
