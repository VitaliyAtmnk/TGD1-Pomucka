import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { api, useApi } from "../api/client";
import type { ExamQuestion, ProgressSummary } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import { Markdown } from "../components/Markdown";
import { Button, Card, KindBadge, LoginHint, PageHeader, Spinner } from "../components/ui";

const SELF = [
  { score: 0.25, label: "Nevěděl/a jsem", cls: "bad" as const },
  { score: 0.6, label: "Částečně", cls: "secondary" as const },
  { score: 1, label: "Zvládl/a jsem", cls: "ok" as const },
];

function QuestionDetail({ q, onRated }: { q: ExamQuestion; onRated?: () => void }) {
  const { user } = useAuth();
  const [rated, setRated] = useState<number | null>(null);
  return (
    <div className="space-y-4">
      {q.outline && (
        <section>
          <h3 className="mb-1 text-sm font-semibold tracking-wide text-muted uppercase">Osnova odpovědi</h3>
          <Markdown>{q.outline}</Markdown>
        </section>
      )}
      {q.algorithms && (
        <section className="rounded-lg border-l-4 border-[var(--k-algorithm)] bg-surface-2 p-3">
          <h3 className="mb-1 text-sm font-semibold tracking-wide text-muted uppercase">Algoritmy a složitost (důraz u zkoušky)</h3>
          <Markdown>{q.algorithms}</Markdown>
        </section>
      )}
      {q.example_tasks && (
        <section>
          <h3 className="mb-1 text-sm font-semibold tracking-wide text-muted uppercase">Možné doplňující dotazy a příklady</h3>
          <Markdown>{q.example_tasks}</Markdown>
        </section>
      )}
      {q.item_details.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-semibold tracking-wide text-muted uppercase">Co je potřeba umět</h3>
          <div className="flex flex-wrap gap-2">
            {q.item_details.map((it) => (
              <Link
                key={it.id}
                to={`/pojem/${it.id}`}
                className="inline-flex items-center gap-2 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm hover:border-accent"
              >
                <KindBadge kind={it.kind} label={it.label} />
                {it.title}
              </Link>
            ))}
          </div>
        </section>
      )}
      {user && (
        <div className="flex flex-wrap items-center gap-2 border-t border-line pt-3">
          <span className="text-sm text-muted">Jak jsi otázku zvládl/a?</span>
          {SELF.map((s) => (
            <Button
              key={s.label}
              variant={rated === s.score ? s.cls : "secondary"}
              onClick={() => {
                setRated(s.score);
                api("/progress/attempts", { method: "POST", json: { kind: "exam", ref_id: String(q.number), correct: s.score >= 0.6, score: s.score } })
                  .then(onRated)
                  .catch(() => undefined);
              }}
            >
              {s.label}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}

function Timer() {
  const [sec, setSec] = useState(0);
  const [running, setRunning] = useState(true);
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setSec((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [running]);
  return (
    <button onClick={() => setRunning((r) => !r)} className="font-mono text-2xl tabular-nums" title="Pozastavit / spustit">
      {String(Math.floor(sec / 60)).padStart(2, "0")}:{String(sec % 60).padStart(2, "0")}
      <span className="ml-2 text-sm">{running ? "⏸" : "▶"}</span>
    </button>
  );
}

export function ExamPage() {
  const { user } = useAuth();
  const location = useLocation();
  const exam = useApi<ExamQuestion[]>("/exam", { cache: true });
  const progress = useApi<ProgressSummary>(user ? "/progress/summary" : null, { deps: [user?.id] });
  const [drawn, setDrawn] = useState<ExamQuestion[] | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [open, setOpen] = useState<number | null>(null);

  useEffect(() => {
    const m = location.hash.match(/otazka-(\d+)/);
    if (m && exam.data) {
      setOpen(Number(m[1]));
      setTimeout(() => document.getElementById(`otazka-${m[1]}`)?.scrollIntoView({ behavior: "smooth" }), 50);
    }
  }, [location.hash, exam.data]);

  const lastScore = new Map(progress.data?.exam.map((e) => [e.number, e.last_score]));

  function draw() {
    if (!exam.data) return;
    const g1 = exam.data.filter((q) => q.group === 1);
    const g2 = exam.data.filter((q) => q.group === 2);
    // prefer weaker questions a bit: weight = 1.5 - last score
    const pick = (list: ExamQuestion[]) => {
      const w = list.map((q) => 1.5 - (lastScore.get(q.number) ?? 0.5));
      let r = Math.random() * w.reduce((a, b) => a + b, 0);
      for (let k = 0; k < list.length; k++) {
        r -= w[k];
        if (r <= 0) return list[k];
      }
      return list[list.length - 1];
    };
    setDrawn([pick(g1), pick(g2)].filter(Boolean));
    setRevealed(false);
  }

  return (
    <div>
      <PageHeader
        title="Příprava na ústní zkoušku"
        subtitle="Ústní část: 2 otázky – jedna z 1.–10. a jedna z 11.–20. Hlavní důraz je na algoritmy a jejich složitost."
      >
        <Button variant="primary" onClick={draw} disabled={!exam.data?.length}>
          🎲 Vylosovat otázky
        </Button>
      </PageHeader>
      {!user && <div className="mb-4"><LoginHint what="sebehodnocení u otázek" /></div>}

      {drawn && (
        <Card className="mb-8 border-accent animate-pop">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Simulace zkoušky</h2>
            <Timer key={drawn.map((q) => q.number).join("-")} />
          </div>
          <ol className="mb-4 space-y-2">
            {drawn.map((q) => (
              <li key={q.number} className="text-xl font-semibold">
                <span className="text-muted">{q.number}.</span> {q.title}
              </li>
            ))}
          </ol>
          {!revealed ? (
            <div>
              <p className="mb-3 text-sm text-muted">
                Připrav si odpověď (definice, věty, algoritmy se složitostí, příklad). Pak si zobraz osnovu a ohodnoť se.
              </p>
              <Button onClick={() => setRevealed(true)}>Zobrazit osnovy</Button>
            </div>
          ) : (
            <div className="space-y-6">
              {drawn.map((q) => (
                <div key={q.number}>
                  <h3 className="mb-2 font-semibold">
                    {q.number}. {q.title}
                  </h3>
                  <QuestionDetail q={q} onRated={progress.reload} />
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {exam.loading && <Spinner />}
      {exam.data?.length === 0 && <p className="text-muted">Otázky ke zkoušce zatím nejsou připravené.</p>}
      {[1, 2].map((group) => (
        <section key={group} className="mb-8">
          <h2 className="mb-3 text-lg font-semibold">{group === 1 ? "Otázky 1–10" : "Otázky 11–20"}</h2>
          <div className="space-y-2">
            {exam.data
              ?.filter((q) => q.group === group)
              .map((q) => {
                const score = lastScore.get(q.number);
                return (
                  <div key={q.number} id={`otazka-${q.number}`} className="scroll-mt-20 rounded-xl border border-line bg-surface">
                    <button className="flex w-full items-center gap-3 px-4 py-3 text-left" onClick={() => setOpen(open === q.number ? null : q.number)}>
                      <span className="w-6 font-semibold text-muted">{q.number}.</span>
                      <span className="flex-1 font-medium">{q.title}</span>
                      {score != null && (
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ background: score >= 0.9 ? "var(--ok)" : score >= 0.5 ? "var(--warn)" : "var(--bad)" }}
                          title={`Poslední sebehodnocení: ${Math.round(score * 100)} %`}
                        />
                      )}
                      <span className="text-muted">{open === q.number ? "−" : "+"}</span>
                    </button>
                    {open === q.number && (
                      <div className="border-t border-line px-4 py-4">
                        <QuestionDetail q={q} onRated={progress.reload} />
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        </section>
      ))}
    </div>
  );
}
