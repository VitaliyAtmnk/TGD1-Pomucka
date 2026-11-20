import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api, useApi } from "../api/client";
import type { AnswerSpec, ChapterSummary, CheckResult, ExerciseTask, ExerciseType } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import { GraphView } from "../components/GraphView";
import { Markdown } from "../components/Markdown";
import { Button, Card, ErrorBox, LoginHint, PageHeader, Segmented, Spinner } from "../components/ui";
import { ALGORITHM_BY_ID } from "../viz/algorithms";
import { toGraph } from "../viz/types";
import { useNavigate } from "react-router-dom";

// exercise type -> visualization to explore the solution
const VIZ_FOR: Record<string, string> = {
  mst: "mst",
  dijkstra: "dijkstra",
  "critical-path": "critical-path",
  "max-flow": "max-flow",
  floyd: "floyd",
  chromatic: "coloring",
};

type Answer = Record<string, unknown>;

function AnswerInput({ spec, value, onChange, disabled }: { spec: AnswerSpec; value: Answer; onChange: (a: Answer) => void; disabled: boolean }) {
  const input = "rounded-lg border border-line bg-surface px-2 py-1.5 text-center tabular-nums outline-none focus:border-accent disabled:opacity-70";
  switch (spec.kind) {
    case "integer":
      return (
        <label className="inline-flex items-center gap-2 font-medium">
          {spec.label}
          <input
            className={`${input} w-28`}
            inputMode="numeric"
            value={(value.value as string) ?? ""}
            onChange={(e) => onChange({ value: e.target.value })}
            disabled={disabled}
            autoFocus
          />
        </label>
      );
    case "vector": {
      const vals = (value.values as string[]) ?? spec.labels.map(() => "");
      return (
        <div className="flex flex-wrap gap-3">
          {spec.labels.map((l, k) => (
            <label key={l} className="flex flex-col items-center text-xs text-muted">
              {l}
              <input
                className={`${input} mt-1 w-16`}
                value={vals[k] ?? ""}
                onChange={(e) => onChange({ values: vals.map((v, j) => (j === k ? e.target.value : v)) })}
                disabled={disabled}
              />
            </label>
          ))}
        </div>
      );
    }
    case "matrix": {
      const m = (value.matrix as string[][]) ?? spec.labels.map(() => spec.labels.map(() => ""));
      return (
        <table className="border-separate border-spacing-1">
          <thead>
            <tr>
              <th />
              {spec.labels.map((l) => (
                <th key={l} className="text-xs text-muted">
                  {l}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {spec.labels.map((l, i) => (
              <tr key={l}>
                <th className="pr-1 text-xs text-muted">{l}</th>
                {spec.labels.map((_, j) => (
                  <td key={j}>
                    <input
                      className={`${input} w-12`}
                      value={m[i][j]}
                      placeholder={i === j ? "0" : ""}
                      onChange={(e) => onChange({ matrix: m.map((r, a) => r.map((v, b) => (a === i && b === j ? e.target.value : v))) })}
                      disabled={disabled}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      );
    }
    case "reducibility":
      return (
        <div className="flex flex-wrap items-center gap-4">
          <Segmented
            value={value.reducible === undefined ? "" : value.reducible ? "yes" : "no"}
            onChange={(v) => !disabled && onChange({ ...value, reducible: v === "yes" })}
            options={[
              { value: "yes", label: "rozložitelná" },
              { value: "no", label: "nerozložitelná" },
            ]}
          />
          <label className="inline-flex items-center gap-2">
            počet kvazikomponent
            <input
              className={`${input} w-16`}
              value={(value.components as string) ?? ""}
              onChange={(e) => onChange({ ...value, components: e.target.value })}
              disabled={disabled}
            />
          </label>
        </div>
      );
    case "sat": {
      const assignment = (value.assignment as Record<string, boolean>) ?? {};
      return (
        <div className="space-y-3">
          <Segmented
            value={value.satisfiable === undefined ? "" : value.satisfiable ? "yes" : "no"}
            onChange={(v) => !disabled && onChange({ ...value, satisfiable: v === "yes" })}
            options={[
              { value: "yes", label: "splnitelná" },
              { value: "no", label: "nesplnitelná" },
            ]}
          />
          {value.satisfiable === true && (
            <div className="flex flex-wrap gap-3">
              {spec.variables.map((v) => (
                <label key={v} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2 py-1">
                  <span className="font-mono">
                    {v.replace(/x(\d+)/, "x")}
                    <sub>{v.slice(1)}</sub> =
                  </span>
                  <button
                    className="w-8 rounded bg-surface-2 font-mono font-semibold"
                    onClick={() => !disabled && onChange({ ...value, assignment: { ...assignment, [v]: !assignment[v] } })}
                    disabled={disabled}
                  >
                    {assignment[v] ? 1 : 0}
                  </button>
                </label>
              ))}
            </div>
          )}
        </div>
      );
    }
  }
}

export function ExercisesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const types = useApi<ExerciseType[]>("/exercises", { cache: true });
  const chapters = useApi<ChapterSummary[]>("/chapters", { cache: true });
  const type = params.get("typ") ?? "";
  const [difficulty, setDifficulty] = useState<"1" | "2">("1");
  const [task, setTask] = useState<ExerciseTask | null>(null);
  const [answer, setAnswer] = useState<Answer>({});
  const [result, setResult] = useState<CheckResult | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [session, setSession] = useState({ total: 0, correct: 0 });

  async function generate(t = type) {
    if (!t) return;
    setResult(null);
    setAnswer({});
    setError(null);
    try {
      setTask(await api<ExerciseTask>("/exercises/generate", { method: "POST", json: { type: t, difficulty: Number(difficulty) } }));
    } catch (e) {
      setError(e as Error);
    }
  }

  useEffect(() => {
    if (type) generate(type);
    else setTask(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, difficulty]);

  async function check() {
    if (!task) return;
    const r = await api<CheckResult>("/exercises/check", {
      method: "POST",
      json: { type: task.type, seed: task.seed, difficulty: task.difficulty, answer },
    });
    setResult(r);
    setSession((s) => ({ total: s.total + 1, correct: s.correct + (r.correct ? 1 : 0) }));
  }

  const chapterTitle = (id: string) => {
    const c = chapters.data?.find((x) => x.id === id);
    return c ? `${c.number}. ${c.title}` : id;
  };
  const viz = task ? ALGORITHM_BY_ID[VIZ_FOR[task.type]] : undefined;
  // the 2-SAT implication graph is part of the solution, so show it only after checking
  const showGraph = !!task?.data.graph && (task.type !== "two-sat" || !!result);

  return (
    <div>
      <PageHeader title="Generované příklady" subtitle="Každý příklad je nově vygenerovaný – zadej výsledek a hned uvidíš řešení.">
        {session.total > 0 && (
          <span className="text-sm text-muted">
            tato relace: {session.correct} / {session.total}
          </span>
        )}
      </PageHeader>
      {!user && <div className="mb-4"><LoginHint what="úspěšnost v příkladech" /></div>}
      {types.loading && <Spinner />}
      <div className="mb-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {types.data?.map((t) => (
          <button
            key={t.id}
            onClick={() => setParams({ typ: t.id })}
            className={`rounded-xl border p-3 text-left transition ${type === t.id ? "border-accent bg-accent-soft" : "border-line bg-surface hover:border-accent"}`}
          >
            <div className="font-semibold">{t.title}</div>
            <div className="text-xs text-muted">{t.description}</div>
            <div className="mt-1 text-xs text-muted">{chapterTitle(t.chapter)}</div>
          </button>
        ))}
      </div>

      {error && <ErrorBox error={error} />}
      {task && (
        <Card className="animate-pop" key={task.seed}>
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <h2 className="text-lg font-semibold">{task.title}</h2>
            <Segmented
              value={difficulty}
              onChange={setDifficulty}
              options={[
                { value: "1", label: "základní" },
                { value: "2", label: "větší" },
              ]}
            />
            <Button className="ml-auto" onClick={() => generate()}>
              🎲 Nový příklad
            </Button>
          </div>
          <div className={showGraph ? "grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]" : ""}>
            <div className="space-y-4">
              <Markdown className="text-[17px]">{task.prompt}</Markdown>
              <AnswerInput spec={task.answer_spec} value={answer} onChange={setAnswer} disabled={!!result} />
              {!result ? (
                <Button variant="primary" onClick={check}>
                  Zkontrolovat
                </Button>
              ) : (
                <div className={`rounded-lg p-4 ${result.correct ? "bg-ok-soft" : "bg-bad-soft"}`}>
                  <p className="mb-2 font-semibold">
                    {result.correct ? "✓ Správně!" : result.score > 0 ? `Částečně správně (${Math.round(result.score * 100)} %)` : "✗ Špatně"}
                  </p>
                  <Markdown>{result.explanation}</Markdown>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button variant="primary" onClick={() => generate()}>
                      Další příklad →
                    </Button>
                    {viz && task.data.graph && (
                      <Button onClick={() => navigate(`/vizualizace/${viz.id}`, { state: { graph: task.data.graph } })}>
                        ▶ Projít postup ve vizualizaci
                      </Button>
                    )}
                  </div>
                </div>
              )}
            </div>
            {showGraph && task.data.graph && (
              <div className="rounded-lg border border-line bg-surface">
                {task.type === "two-sat" && <p className="px-3 pt-2 text-sm text-muted">Implikační graf formule</p>}
                <GraphView graph={toGraph(task.data.graph)} showWeights className="max-h-[55vh]" />
              </div>
            )}
          </div>
        </Card>
      )}
      {!type && !types.loading && <p className="text-muted">Vyber typ příkladu.</p>}
    </div>
  );
}
