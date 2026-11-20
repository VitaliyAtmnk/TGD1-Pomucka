import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { Example, Item } from "../api/types";
import { ALGORITHM_BY_ID } from "../viz/algorithms";
import { toGraph } from "../viz/types";
import { GraphView } from "./GraphView";
import { Illustrations } from "./Illustration";
import { Markdown } from "./Markdown";
import { Button, kindColor, PROVABLE } from "./ui";

export function Statement({ item }: { item: Item }) {
  // Theorem-like statements are set in italics like in a math textbook; definitions stay upright.
  return (
    <div
      className={`relative rounded-lg border bg-surface px-5 py-4 text-[1.07rem] ${PROVABLE.includes(item.kind) ? "statement-italic" : ""}`}
      style={{ borderColor: `color-mix(in srgb, ${kindColor(item.kind)} 40%, var(--line))` }}
    >
      <Markdown>{item.statement}</Markdown>
    </div>
  );
}

function ExampleView({ ex, viz }: { ex: Example; viz?: string }) {
  const navigate = useNavigate();
  const algo = viz ? ALGORITHM_BY_ID[viz] : undefined;
  const graph = ex.graph ? toGraph(ex.graph) : null;
  return (
    <div className="rounded-lg border border-line bg-surface p-4">
      {ex.title && <h4 className="mb-2 font-semibold">{ex.title}</h4>}
      <div className={graph ? "grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,320px)]" : ""}>
        <Markdown>{ex.body}</Markdown>
        {graph && (
          <div>
            <div className="rounded-lg bg-surface-2/50">
              <GraphView graph={graph} showWeights={graph.edges.some((e) => e.w !== undefined)} className="max-h-72" />
            </div>
            {algo && (
              <Button className="mt-2 w-full" onClick={() => navigate(`/vizualizace/${algo.id}`, { state: { graph: ex.graph } })}>
                ▶ Spustit „{algo.short}“ na tomto grafu
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function ItemBody({ item, showProofInitially = false }: { item: Item; showProofInitially?: boolean }) {
  const [showProof, setShowProof] = useState(showProofInitially);
  const algo = item.visualization ? ALGORITHM_BY_ID[item.visualization] : undefined;

  return (
    <div className="space-y-5">
      <Statement item={item} />

      {item.intuition && (
        <section>
          <h3 className="label-caps mb-1.5">Intuice</h3>
          <Markdown>{item.intuition}</Markdown>
        </section>
      )}

      <Illustrations items={item.illustrations} target="statement" />

      {item.pseudocode && (
        <section>
          <h3 className="label-caps mb-1.5">Algoritmus</h3>
          <div className="rounded-lg bg-surface-2 p-3">
            <Markdown>{item.pseudocode}</Markdown>
          </div>
        </section>
      )}

      {item.complexity && (
        <div className="text-sm">
          <span className="font-semibold">Složitost: </span>
          <Markdown className="inline-block [&_p]:my-0">{item.complexity}</Markdown>
        </div>
      )}

      {algo && (
        <Link
          to={`/vizualizace/${algo.id}`}
          className="group flex items-center gap-3 rounded-lg border border-line bg-surface p-3 transition hover:border-accent"
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-mark font-bold text-[var(--g-on-mark)]">▶</span>
          <span>
            <span className="block font-semibold text-accent">Interaktivní vizualizace: {algo.title}</span>
            <span className="text-sm text-muted">Krokuj algoritmus, měň graf a parametry.</span>
          </span>
        </Link>
      )}
      {item.visualization && !algo && <p className="text-sm text-muted">Vizualizace k této položce se připravuje.</p>}

      <Illustrations items={item.illustrations} target="proof" />

      {item.proof && (
        <section>
          <div className="mb-1.5 flex flex-wrap items-center gap-3">
            <h3 className="label-caps">Důkaz</h3>
            <button className="text-sm text-accent underline" onClick={() => setShowProof((s) => !s)}>
              {showProof ? "skrýt" : "zobrazit"}
            </button>
            {item.proof_steps.length >= 3 && (
              <Link to={`/opakovani?rezim=dukazy&polozka=${item.id}`} className="text-sm text-accent underline">
                procvičit pořadí kroků
              </Link>
            )}
          </div>
          {showProof ? (
            <div className="rounded-lg border border-line bg-surface p-4">
              {item.proof_steps.length > 0 && (
                <div className="mb-4 rounded-md bg-surface-2 p-3 text-sm">
                  <div className="mb-1 font-semibold">Struktura důkazu</div>
                  <ol className="list-decimal space-y-0.5 pl-5">
                    {item.proof_steps.map((s, i) => (
                      <li key={i}>
                        <Markdown className="[&_p]:my-0">{s}</Markdown>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
              <Markdown>{item.proof}</Markdown>
              <div className="mt-2 text-right text-lg text-muted" aria-label="konec důkazu">□</div>
            </div>
          ) : (
            <p className="text-sm text-muted">Zkus si důkaz nejdřív rozmyslet sám, pak si ho rozbal.</p>
          )}
        </section>
      )}

      {item.examples.length > 0 && (
        <section>
          <h3 className="label-caps mb-1.5">
            {item.examples.length === 1 ? "Příklad" : "Příklady"}
          </h3>
          <div className="space-y-3">
            {item.examples.map((ex, i) => (
              <ExampleView key={i} ex={ex} viz={item.visualization} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
