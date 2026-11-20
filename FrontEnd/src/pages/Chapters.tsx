import { useEffect, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { useApi } from "../api/client";
import type { Chapter, ChapterSummary, ExamQuestion, Item, ProgressSummary } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import { ItemBody } from "../components/ItemView";
import { Markdown } from "../components/Markdown";
import { Card, ErrorBox, KindBadge, PageHeader, pct, ProgressBar, Spinner, SupplementedBadge } from "../components/ui";

export function ChaptersPage() {
  const { user } = useAuth();
  const chapters = useApi<ChapterSummary[]>("/chapters", { cache: true });
  const progress = useApi<ProgressSummary>(user ? "/progress/summary" : null, { deps: [user?.id] });
  const byId = new Map(progress.data?.chapters.map((c) => [c.chapter_id, c]));
  return (
    <div>
      <PageHeader title="Kapitoly" subtitle="Látka seřazená podle skript a přednášek." />
      {chapters.loading && <Spinner />}
      {chapters.error && <ErrorBox error={chapters.error} onRetry={chapters.reload} />}
      <div className="space-y-3">
        {chapters.data?.map((ch) => {
          const p = byId.get(ch.id);
          return (
            <Card key={ch.id}>
              <div className="flex flex-wrap items-start gap-4">
                <span className="w-10 font-display text-3xl font-bold text-muted tabular-nums">{ch.number}</span>
                <div className="min-w-0 flex-1">
                  <Link to={`/kapitola/${ch.id}`} className="text-lg font-semibold hover:text-accent">
                    {ch.title}
                  </Link>
                  {ch.summary && <Markdown className="mt-1 text-sm text-muted">{ch.summary}</Markdown>}
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                    {Object.entries(ch.counts).map(([k, v]) => (
                      <span key={k}>
                        <KindBadge kind={k as Item["kind"]} /> {v}
                      </span>
                    ))}
                    {ch.exam_questions.length > 0 && <span>Otázky ke zkoušce: {ch.exam_questions.join(", ")}</span>}
                  </div>
                </div>
                <div className="w-full sm:w-48">
                  {p ? (
                    <>
                      <div className="mb-1 flex justify-between text-xs text-muted">
                        <span>Zvládnuto</span>
                        <span>{pct(p.mastery)}</span>
                      </div>
                      <ProgressBar value={p.mastery} />
                      <div className="mt-1 text-xs text-muted">
                        kartičky {p.cards_learned}/{p.cards_total} · kvíz {pct(p.quiz_accuracy)}
                      </div>
                    </>
                  ) : null}
                  <div className="mt-2 flex gap-2">
                    <Link to={`/kapitola/${ch.id}`} className="text-sm text-accent underline">
                      Číst
                    </Link>
                    <Link to={`/opakovani?kapitola=${ch.id}`} className="text-sm text-accent underline">
                      Opakovat
                    </Link>
                  </div>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function ChapterItem({ item, open, onToggle }: { item: Item; open: boolean; onToggle: () => void }) {
  return (
    <div id={item.id} className="scroll-mt-20 rounded-xl border border-line bg-surface">
      <button onClick={onToggle} className="flex w-full flex-wrap items-center gap-2 px-4 py-3 text-left" aria-expanded={open}>
        <KindBadge kind={item.kind} label={item.label} />
        <span className="font-semibold">{item.title}</span>
        {item.supplemented && <SupplementedBadge />}
        {(item.illustrations?.length ?? 0) > 0 && (
          <span className="rounded-sm bg-mark-soft px-1.5 font-mono text-[0.7rem] font-semibold" title="Má krokovanou ilustraci">
            ilustrace
          </span>
        )}
        <span className="ml-auto text-muted">{open ? "−" : "+"}</span>
      </button>
      {open && (
        <div className="border-t border-line px-4 py-4">
          <ItemBody item={item} />
          <Link to={`/pojem/${item.id}`} className="mt-4 inline-block text-sm text-accent underline">
            Samostatná stránka
          </Link>
        </div>
      )}
    </div>
  );
}

export function ChapterPage() {
  const { id = "" } = useParams();
  const location = useLocation();
  const { data: ch, error, loading, reload } = useApi<Chapter>(`/chapters/${id}`, { cache: true });
  const exam = useApi<ExamQuestion[]>("/exam", { cache: true });
  const [open, setOpen] = useState<Set<string>>(new Set());

  useEffect(() => {
    const hash = location.hash.slice(1);
    if (hash && ch) {
      setOpen(new Set([hash]));
      setTimeout(() => document.getElementById(hash)?.scrollIntoView({ behavior: "smooth" }), 50);
    }
  }, [location.hash, ch]);

  if (loading) return <Spinner />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  if (!ch) return null;

  const sections = ch.sections.length ? ch.sections : [{ number: "", title: "" }];
  const examQs = exam.data?.filter((q) => ch.exam_questions.includes(q.number)) ?? [];
  const toggle = (itemId: string) =>
    setOpen((s) => {
      const n = new Set(s);
      if (n.has(itemId)) n.delete(itemId);
      else n.add(itemId);
      return n;
    });

  return (
    <div className="grid gap-8 lg:grid-cols-[220px_minmax(0,1fr)]">
      <aside className="hidden lg:sticky lg:top-20 lg:block lg:self-start">
        <div className="mb-2 text-xs font-semibold tracking-wide text-muted uppercase">Obsah kapitoly</div>
        <ul className="space-y-1 text-sm">
          {ch.sections.map((s) => (
            <li key={s.number}>
              <a href={`#sec-${s.number}`} className="block rounded px-2 py-1 text-muted hover:bg-surface hover:text-ink">
                {s.number} {s.title}
              </a>
            </li>
          ))}
        </ul>
      </aside>
      <div className="min-w-0">
        <PageHeader title={`${ch.number}. ${ch.title}`} subtitle={ch.source}>
          <div className="flex gap-2">
            <button className="rounded-lg border border-line px-3 py-2 text-sm" onClick={() => setOpen(new Set(ch.items.map((i) => i.id)))}>
              Rozbalit vše
            </button>
            <Link to={`/opakovani?kapitola=${ch.id}`} className="rounded-lg bg-accent px-3 py-2 text-sm font-medium text-accent-ink">
              Opakovat kapitolu
            </Link>
          </div>
        </PageHeader>
        {ch.summary && <Markdown className="mb-6 max-w-3xl text-muted">{ch.summary}</Markdown>}
        {examQs.length > 0 && (
          <div className="mb-6 rounded-lg bg-surface-2 p-3 text-sm">
            <span className="font-semibold">Otázky ke zkoušce: </span>
            {examQs.map((q, i) => (
              <span key={q.number}>
                {i > 0 && " · "}
                <Link to={`/zkouska#otazka-${q.number}`} className="text-accent underline">
                  {q.number}. {q.title}
                </Link>
              </span>
            ))}
          </div>
        )}
        <div className="space-y-8">
          {sections.map((s) => {
            const items = ch.items.filter((it) => (s.number ? it.section === s.number : true));
            if (!items.length) return null;
            return (
              <section key={s.number} id={`sec-${s.number}`} className="scroll-mt-20">
                {s.number && (
                  <h2 className="mb-3 text-lg font-semibold">
                    <span className="text-muted">{s.number}</span> {s.title}
                  </h2>
                )}
                <div className="space-y-2">
                  {items.map((it) => (
                    <ChapterItem key={it.id} item={it} open={open.has(it.id)} onToggle={() => toggle(it.id)} />
                  ))}
                </div>
              </section>
            );
          })}
          {ch.sections.length > 0 &&
            (() => {
              const known = new Set(ch.sections.map((s) => s.number));
              const rest = ch.items.filter((it) => !it.section || !known.has(it.section));
              return rest.length ? (
                <section>
                  <h2 className="mb-3 text-lg font-semibold">Další</h2>
                  <div className="space-y-2">
                    {rest.map((it) => (
                      <ChapterItem key={it.id} item={it} open={open.has(it.id)} onToggle={() => toggle(it.id)} />
                    ))}
                  </div>
                </section>
              ) : null;
            })()}
        </div>
      </div>
    </div>
  );
}
