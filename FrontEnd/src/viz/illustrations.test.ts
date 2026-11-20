/**
 * Content checker for concept illustrations in content/chapters/*.yaml.
 * Every illustration step must resolve (edges/highlights exist) and its property must be known.
 * Run with ILLUSTRATION_REPORT=1 to print the live property verdict of every step,
 * so authors can check that captions agree with what the app computes:
 *   ILLUSTRATION_REPORT=1 npx vitest run src/viz/illustrations.test.ts
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import yaml from "js-yaml";
import { describe, expect, it } from "vitest";
import type { Illustration } from "../api/types";
import { edgeByKey, frameAt } from "./illustration";
import { PROPERTIES } from "./properties";
import { toGraph } from "./types";

const dir = join(__dirname, "..", "..", "..", "content", "chapters");
const report = !!(globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env.ILLUSTRATION_REPORT;

interface ChapterFile {
  id: string;
  items: { id: string; illustrations?: Illustration[] }[];
}

const chapters = readdirSync(dir)
  .filter((f) => f.endsWith(".yaml"))
  .map((f) => ({ file: f, data: yaml.load(readFileSync(join(dir, f), "utf8")) as ChapterFile }));

describe("concept illustrations in content", () => {
  for (const { file, data } of chapters) {
    const withIll = data.items.filter((it) => it.illustrations?.length);
    if (!withIll.length) continue;
    it(`${file}: ${withIll.length} items with illustrations`, () => {
      const lines: string[] = [];
      for (const item of withIll)
        for (const ill of item.illustrations!) {
          const base = toGraph(ill.graph);
          expect(base.nodes.every((n) => !n.id.includes("-")), `${item.id}: node ids must not contain "-"`).toBe(true);
          if (ill.property) expect(PROPERTIES[ill.property], `${item.id}: unknown property ${ill.property}`).toBeDefined();
          lines.push(`${item.id} — „${ill.title}“ [${ill.for ?? "statement"}${ill.property ? `, ${ill.property}` : ""}]`);
          ill.steps.forEach((st, k) => {
            const f = frameAt(base, ill.steps, k);
            for (const key of Object.keys(st.edges ?? {}))
              expect(edgeByKey(f.graph, key), `${item.id} step ${k + 1}: edge ${key} does not exist`).toBeGreaterThanOrEqual(0);
            for (const key of Object.keys(st.edge_labels ?? {}))
              expect(edgeByKey(f.graph, key), `${item.id} step ${k + 1}: edge_labels ${key} does not exist`).toBeGreaterThanOrEqual(0);
            for (const key of st.edge_set ?? [])
              expect(edgeByKey(f.graph, key), `${item.id} step ${k + 1}: edge_set ${key} does not exist`).toBeGreaterThanOrEqual(0);
            const verdict = ill.property ? PROPERTIES[ill.property].check(f.graph, f) : null;
            lines.push(
              `   ${k + 1}. ${verdict ? (verdict.ok ? "✓" : "✗") + " " + verdict.text.replace(/\s+/g, " ") : "(bez vlastnosti)"}\n      popisek: ${st.caption.replace(/\s+/g, " ").trim().slice(0, 160)}`,
            );
          });
        }
      if (report) console.log(`\n=== ${file}\n${lines.join("\n")}`);
    });
  }
});
