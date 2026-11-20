import { useEffect, useState } from "react";
import { GraphView } from "../components/GraphView";
import { Markdown } from "../components/Markdown";
import { Button } from "../components/ui";
import type { Graph, Step, StepTable } from "./types";

export function StepTable_({ t }: { t: StepTable }) {
  const hl = new Set((t.highlight ?? []).map(([r, c]) => `${r},${c}`));
  const dim = new Set((t.dim ?? []).map(([r, c]) => `${r},${c}`));
  return (
    <div className="overflow-x-auto">
      {t.title && <div className="mb-1 text-sm font-semibold">{t.title}</div>}
      <table className="border-collapse text-sm tabular-nums">
        <thead>
          <tr>
            {t.rowHeaders && <th className="px-2 py-1" />}
            {t.columns.map((c) => (
              <th key={c} className="border-b border-line px-2 py-1 text-center font-semibold text-muted">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {t.rows.map((row, r) => (
            <tr key={r}>
              {t.rowHeaders && <th className="border-r border-line px-2 py-1 text-right font-semibold text-muted">{t.rowHeaders[r]}</th>}
              {row.map((v, c) => (
                <td
                  key={c}
                  className={`px-2.5 py-1 text-center transition-colors ${
                    hl.has(`${r},${c}`) ? "bg-mark-soft font-bold" : dim.has(`${r},${c}`) ? "bg-accent-soft" : ""
                  }`}
                >
                  {v}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface Props {
  graph: Graph;
  steps: Step[];
  pseudocode: string[];
  weighted: boolean;
}

export function StepPlayer({ graph, steps, pseudocode, weighted }: Props) {
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1200);
  const step = steps[Math.min(i, steps.length - 1)];

  useEffect(() => {
    setI(0);
    setPlaying(false);
  }, [steps]);

  useEffect(() => {
    if (!playing) return;
    if (i >= steps.length - 1) {
      setPlaying(false);
      return;
    }
    const t = setTimeout(() => setI((x) => x + 1), speed);
    return () => clearTimeout(t);
  }, [playing, i, speed, steps.length]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.target as HTMLElement).closest("input, select, textarea")) return;
      if (e.key === "ArrowRight") setI((x) => Math.min(steps.length - 1, x + 1));
      if (e.key === "ArrowLeft") setI((x) => Math.max(0, x - 1));
      if (e.key === " ") {
        e.preventDefault();
        setPlaying((p) => !p);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [steps.length]);

  if (!step) return null;
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <div>
        <div className="rounded-lg border border-line bg-surface">
          <GraphView graph={graph} nodeStyles={step.nodes} edgeStyles={step.edges} showWeights={weighted} className="max-h-[60vh]" />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button onClick={() => setI(0)} disabled={i === 0} aria-label="Na začátek">
            ⏮
          </Button>
          <Button onClick={() => setI((x) => Math.max(0, x - 1))} disabled={i === 0} aria-label="Krok zpět">
            ◀
          </Button>
          <Button variant="primary" onClick={() => setPlaying((p) => !p)} className="min-w-24">
            {playing ? "⏸ Pauza" : i >= steps.length - 1 ? "Konec" : "▶ Přehrát"}
          </Button>
          <Button onClick={() => setI((x) => Math.min(steps.length - 1, x + 1))} disabled={i >= steps.length - 1} aria-label="Další krok">
            ▶
          </Button>
          <Button onClick={() => setI(steps.length - 1)} disabled={i >= steps.length - 1} aria-label="Na konec">
            ⏭
          </Button>
          <select
            className="rounded-lg border border-line bg-surface px-2 py-2 text-sm"
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
            aria-label="Rychlost"
          >
            <option value={2400}>pomalu</option>
            <option value={1200}>normálně</option>
            <option value={500}>rychle</option>
          </select>
          <span className="ml-auto text-sm tabular-nums text-muted">
            krok {i + 1} / {steps.length}
          </span>
        </div>
        <input
          type="range"
          min={0}
          max={steps.length - 1}
          value={i}
          onChange={(e) => setI(Number(e.target.value))}
          className="mt-2 w-full accent-[var(--accent)]"
          aria-label="Posun v krocích"
        />
        <p className="mt-1 text-xs text-muted">Klávesy: ← → krokování, mezerník přehrát/pauza.</p>
      </div>
      <div className="space-y-4">
        <div className="animate-pop rounded-lg border border-line bg-surface p-4" key={i}>
          <div className="mb-1.5 font-mono text-xs font-semibold text-muted">
            krok {i + 1} / {steps.length}
          </div>
          <Markdown>{step.message}</Markdown>
        </div>
        {step.info && (
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
            {step.info.map((x) => (
              <div key={x.label} className="contents">
                <dt className="font-semibold text-muted">{x.label}</dt>
                <dd className="font-mono">{x.value}</dd>
              </div>
            ))}
          </dl>
        )}
        {step.tables?.map((t, k) => <StepTable_ key={k} t={t} />)}
        <div>
          <div className="label-caps mb-1">Pseudokód</div>
          <ol className="rounded-lg border border-line bg-surface p-2 font-mono text-[12.5px] leading-6">
            {pseudocode.map((line, k) => (
              <li
                key={k}
                className={`whitespace-pre-wrap rounded-sm px-2 ${step.line === k ? "bg-mark-soft font-semibold" : "text-muted"}`}
              >
                {line}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}
