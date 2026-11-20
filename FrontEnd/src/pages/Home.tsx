import { Link } from "react-router-dom";
import { useApi } from "../api/client";
import type { ChapterSummary, ExamQuestion, ProgressSummary } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import { Card, LoginHint, PageHeader, ProgressBar, Spinner } from "../components/ui";

function examColor(score: number | null | undefined) {
  if (score == null) return "var(--surface-2)";
  if (score >= 0.9) return "var(--ok)";
  if (score >= 0.5) return "var(--warn)";
  return "var(--bad)";
}

export function HomePage() {
  const { user } = useAuth();
  const chapters = useApi<ChapterSummary[]>("/chapters", { cache: true });
  const exam = useApi<ExamQuestion[]>("/exam", { cache: true });
  const progress = useApi<ProgressSummary>(user ? "/progress/summary" : null, { deps: [user?.id] });
  const byId = new Map(progress.data?.chapters.map((c) => [c.chapter_id, c]));
  const examScore = new Map(progress.data?.exam.map((e) => [e.number, e.last_score]));
  const due = progress.data?.chapters.reduce((a, c) => a + c.cards_due, 0) ?? 0;
  const overall = progress.data?.chapters.length
    ? progress.data.chapters.reduce((a, c) => a + c.mastery, 0) / progress.data.chapters.length
    : null;

  return (
    <div>
      <PageHeader
        title={user ? `Ahoj, ${user.display_name}` : "Přehled"}
        subtitle={
          user && progress.data
            ? `Celkem zvládnuto ${Math.round((overall ?? 0) * 100)} % látky · ${progress.data.total_reviews} opakování${
                progress.data.streak_days > 0 ? ` · ${progress.data.streak_days} ${progress.data.streak_days === 1 ? "den" : "dní"} v řadě` : ""
              }`
            : "Obsah předmětu, tvůj pokrok a co dnes zopakovat."
        }
      />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section aria-labelledby="toc">
          <h2 id="toc" className="label-caps mb-3">
            Obsah
          </h2>
          {chapters.loading && <Spinner />}
          <ol className="divide-y divide-line rounded-lg border border-line bg-surface">
            {chapters.data?.map((ch) => {
              const p = byId.get(ch.id);
              return (
                <li key={ch.id} className="group px-4 py-3 sm:px-5">
                  <div className="flex items-baseline gap-3">
                    <span className="w-6 shrink-0 font-display text-xl font-bold text-muted tabular-nums">{ch.number}</span>
                    <Link to={`/kapitola/${ch.id}`} className="min-w-0 font-display text-[1.08rem] font-semibold group-hover:text-accent">
                      {ch.title}
                    </Link>
                    <span className="hidden min-w-6 flex-1 translate-y-[-0.3em] border-b-2 border-dotted border-line sm:block" aria-hidden="true" />
                    <span className="ml-auto shrink-0 font-mono text-sm text-muted tabular-nums sm:ml-0">
                      {p ? `${Math.round(p.mastery * 100)} %` : `${ch.item_count} položek`}
                    </span>
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 pl-9 text-sm text-muted">
                    {ch.exam_questions.length > 0 && <span>otázky {ch.exam_questions.join(", ")}</span>}
                    <span>
                      {ch.quiz_count} kvízových otázek · {ch.proof_count} důkazů ke skládání
                    </span>
                    <Link to={`/opakovani?kapitola=${ch.id}`} className="font-semibold text-accent opacity-80 hover:opacity-100">
                      opakovat →
                    </Link>
                  </div>
                  {p && <ProgressBar value={p.mastery} className="mt-2 ml-9 w-[calc(100%-2.25rem)]" />}
                </li>
              );
            })}
          </ol>
        </section>

        <aside className="space-y-5">
          <Card>
            <h2 className="label-caps mb-2">Dnes</h2>
            {user ? (
              progress.data ? (
                <>
                  <p className="font-display text-3xl font-bold tabular-nums">
                    {due} <span className="text-base font-semibold text-muted">{due === 1 ? "kartička" : due >= 2 && due <= 4 ? "kartičky" : "kartiček"} k opakování</span>
                  </p>
                  <Link
                    to="/opakovani"
                    className="mt-3 inline-flex rounded-md bg-accent px-3.5 py-2 text-sm font-semibold text-accent-ink"
                  >
                    {due > 0 ? "Zopakovat" : "Naučit se nové kartičky"}
                  </Link>
                </>
              ) : (
                <Spinner />
              )
            ) : (
              <>
                <p className="mb-3 text-sm text-muted">
                  Kartičky, kvízy i příklady fungují i bez účtu. S účtem se ti navíc plánuje opakování a ukládá úspěšnost po kapitolách.
                </p>
                <LoginHint what="pokrok" />
              </>
            )}
          </Card>

          <Card>
            <div className="mb-2 flex items-baseline justify-between">
              <h2 className="label-caps">Ústní zkouška</h2>
              <Link to="/zkouska" className="text-sm font-semibold text-accent">
                losovat →
              </Link>
            </div>
            <p className="mb-3 text-sm text-muted">1 otázka z 1.–10. a 1 z 11.–20. Barva je tvoje poslední sebehodnocení.</p>
            <div className="grid grid-cols-10 gap-1">
              {(exam.data ?? Array.from({ length: 20 }, (_, i) => ({ number: i + 1, title: "" }) as ExamQuestion)).map((q) => (
                <Link
                  key={q.number}
                  to={`/zkouska#otazka-${q.number}`}
                  title={`${q.number}. ${q.title}`}
                  className="grid aspect-square place-items-center rounded-sm border border-line font-mono text-xs font-semibold tabular-nums hover:border-accent"
                  style={{
                    background: examColor(examScore.get(q.number)),
                    color: examScore.get(q.number) != null ? "var(--surface)" : "var(--muted)",
                  }}
                >
                  {q.number}
                </Link>
              ))}
            </div>
          </Card>

          <Card>
            <h2 className="label-caps mb-2">Procvičování</h2>
            <ul className="space-y-1.5 text-[0.95rem]">
              <li>
                <Link to="/priklady" className="font-semibold hover:text-accent">
                  Generované příklady
                </Link>
                <span className="text-muted"> – jako u písemky, s kontrolou</span>
              </li>
              <li>
                <Link to="/vizualizace" className="font-semibold hover:text-accent">
                  Vizualizace algoritmů
                </Link>
                <span className="text-muted"> – krok za krokem</span>
              </li>
              <li>
                <Link to="/opakovani?rezim=dukazy" className="font-semibold hover:text-accent">
                  Skládání důkazů
                </Link>
                <span className="text-muted"> – pořadí kroků</span>
              </li>
            </ul>
          </Card>
        </aside>
      </div>
    </div>
  );
}
