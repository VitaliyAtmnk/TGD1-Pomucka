import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, cached, useApi } from "../api/client";
import type { Chapter, ChapterSummary, Item, QuizQuestion, SrsQueue } from "../api/types";
import { useAuth } from "../auth/AuthContext";
import { Statement } from "../components/ItemView";
import { InlineMarkdown, Markdown } from "../components/Markdown";
import { Button, Card, KIND_LABEL, KindBadge, LoginHint, PageHeader, Segmented, Spinner } from "../components/ui";

type Mode = "karticky" | "kviz" | "dukazy";

function shuffle<T>(xs: T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function recordAttempt(body: { kind: string; ref_id: string; chapter_id?: string; correct: boolean; score?: number }) {
  api("/progress/attempts", { method: "POST", json: body }).catch(() => undefined);
}

async function loadChapters(ids: string[]): Promise<Chapter[]> {
  return Promise.all(ids.map((id) => cached<Chapter>(`/chapters/${id}`)));
}

export function ReviewPage() {
  const [params, setParams] = useSearchParams();
  const chapters = useApi<ChapterSummary[]>("/chapters", { cache: true });
  const mode = (params.get("rezim") as Mode) || "karticky";
  const selected = params.getAll("kapitola");
  const itemParam = params.get("polozka");
  const [started, setStarted] = useState(!!itemParam || selected.length > 0);
  const [session, setSession] = useState(0);

  const all = useMemo(() => chapters.data?.map((c) => c.id) ?? [], [chapters.data]);
  const selectedKey = selected.join("|");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const chosen = useMemo(() => (selected.length ? selected : all), [selectedKey, all]);

  function update(next: { rezim?: Mode; kapitola?: string[] }) {
    const p = new URLSearchParams();
    p.set("rezim", next.rezim ?? mode);
    (next.kapitola ?? selected).forEach((c) => p.append("kapitola", c));
    setParams(p, { replace: true });
    setStarted(false);
  }

  function toggleChapter(id: string) {
    const set = new Set(selected);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    update({ kapitola: [...set] });
  }

  return (
    <div>
      <PageHeader title="Opakování" subtitle="Vyber kapitoly a způsob procvičování.">
        <Segmented
          value={mode}
          onChange={(m) => update({ rezim: m })}
          options={[
            { value: "karticky", label: "Kartičky" },
            { value: "kviz", label: "Kvíz" },
            { value: "dukazy", label: "Skládání důkazů" },
          ]}
        />
      </PageHeader>

      {!started ? (
        <Card>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold">Kapitoly</h2>
            <div className="flex gap-3 text-sm">
              <button className="text-accent underline" onClick={() => update({ kapitola: all })}>
                vybrat vše
              </button>
              <button className="text-accent underline" onClick={() => update({ kapitola: [] })}>
                zrušit výběr
              </button>
            </div>
          </div>
          {chapters.loading && <Spinner />}
          <div className="grid gap-1 sm:grid-cols-2">
            {chapters.data?.map((c) => (
              <label key={c.id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-surface-2">
                <input type="checkbox" checked={selected.includes(c.id)} onChange={() => toggleChapter(c.id)} />
                <span className="text-muted">{c.number}.</span> {c.title}
              </label>
            ))}
          </div>
          <p className="mt-3 text-sm text-muted">Bez výběru se opakuje celá látka.</p>
          <Button
            variant="primary"
            className="mt-4"
            onClick={() => {
              setStarted(true);
              setSession((s) => s + 1);
            }}
            disabled={!chapters.data}
          >
            Začít
          </Button>
        </Card>
      ) : (
        <div>
          <button className="mb-4 text-sm text-muted hover:text-ink" onClick={() => setStarted(false)}>
            ← změnit výběr
          </button>
          {mode === "karticky" && <Flashcards key={session} chapterIds={chosen} />}
          {mode === "kviz" && <Quiz key={session} chapterIds={chosen} />}
          {mode === "dukazy" && <ProofOrder key={`${session}-${itemParam}`} chapterIds={chosen} itemId={itemParam} />}
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ Flashcards

const GRADES = [
  { grade: 1, label: "Znovu", hint: "nevěděl/a jsem", variant: "bad" as const },
  { grade: 3, label: "Těžké", hint: "s námahou", variant: "secondary" as const },
  { grade: 4, label: "Dobře", hint: "věděl/a jsem", variant: "secondary" as const },
  { grade: 5, label: "Snadné", hint: "hned", variant: "ok" as const },
];

function prompt(item: Item) {
  if (item.kind === "definition") return "Zformuluj definici.";
  if (item.kind === "algorithm") return "Popiš algoritmus a jeho složitost.";
  if (item.kind === "remark") return "Co říká tato poznámka?";
  return `Zformuluj ${KIND_LABEL[item.kind].toLowerCase() === "věta" ? "větu" : "tvrzení"} (a rozmysli si důkaz).`;
}

function Flashcards({ chapterIds }: { chapterIds: string[] }) {
  const { user } = useAuth();
  const [cards, setCards] = useState<(Item & { chapter_id: string })[] | null>(null);
  const [meta, setMeta] = useState<{ due: number; new: number } | null>(null);
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [stats, setStats] = useState({ done: 0, good: 0 });

  useEffect(() => {
    if (user) {
      const q = chapterIds.map((c) => `chapters=${encodeURIComponent(c)}`).join("&");
      api<SrsQueue>(`/srs/queue?${q}&limit=30&new_limit=15`).then((r) => {
        setCards(r.cards.map((c) => c.item));
        setMeta({ due: r.due_count, new: r.new_count });
      });
    } else {
      loadChapters(chapterIds).then((chs) =>
        setCards(shuffle(chs.flatMap((ch) => ch.items.map((it) => ({ ...it, chapter_id: ch.id })))).slice(0, 30)),
      );
    }
  }, [user, chapterIds]);

  const grade = useCallback(
    (g: number) => {
      if (!cards) return;
      const card = cards[i];
      if (user) api("/srs/review", { method: "POST", json: { item_id: card.id, grade: g } }).catch(() => undefined);
      setStats((s) => ({ done: s.done + 1, good: s.good + (g >= 3 ? 1 : 0) }));
      if (g < 3) setCards([...cards, card]); // see it again in this session
      setFlipped(false);
      setI((x) => x + 1);
    },
    [cards, i, user],
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        setFlipped(true);
      }
      if (flipped && ["1", "2", "3", "4"].includes(e.key)) grade(GRADES[Number(e.key) - 1].grade);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [flipped, grade]);

  if (!cards) return <Spinner />;
  if (i >= cards.length)
    return (
      <Card className="text-center">
        <h2 className="text-xl font-semibold">{cards.length === 0 ? "Nic k opakování 🎉" : "Hotovo!"}</h2>
        <p className="mt-2 text-muted">
          {cards.length === 0
            ? "V těchto kapitolách teď nemáš žádné kartičky k opakování. Přijď zítra nebo zkus kvíz."
            : `Zopakováno ${stats.done} kartiček, z toho ${stats.good} úspěšně.`}
        </p>
        {!user && <div className="mx-auto mt-4 max-w-md"><LoginHint what="rozložené opakování" /></div>}
      </Card>
    );

  const card = cards[i];
  return (
    <div className="mx-auto max-w-3xl">
      {!user && <div className="mb-4"><LoginHint what="pokrok v kartičkách (algoritmus rozloženého opakování)" /></div>}
      <div className="mb-2 flex justify-between text-sm text-muted">
        <span>
          {i + 1} / {cards.length}
          {meta && ` · k opakování ${meta.due}, nových ${meta.new}`}
        </span>
        <span>úspěšnost {stats.done ? Math.round((stats.good / stats.done) * 100) : 0} %</span>
      </div>
      <Card className="min-h-72 animate-pop" key={`${i}-${card.id}`}>
        <div className="mb-3 flex items-center gap-2">
          <KindBadge kind={card.kind} label={card.label} />
          <span className="text-xs text-muted">{card.chapter_id}</span>
        </div>
        <h2 className="mb-1 text-2xl font-bold">{card.title}</h2>
        <p className="text-muted">{prompt(card)}</p>
        {flipped ? (
          <div className="mt-5 space-y-4 border-t border-line pt-5">
            <Statement item={card} />
            {card.intuition && (
              <details className="text-sm">
                <summary className="cursor-pointer text-muted">Intuice</summary>
                <Markdown className="mt-2">{card.intuition}</Markdown>
              </details>
            )}
            {card.complexity && (
              <div className="text-sm">
                <span className="font-semibold">Složitost: </span>
                <InlineMarkdown>{card.complexity}</InlineMarkdown>
              </div>
            )}
            <Link to={`/pojem/${card.id}`} target="_blank" className="text-sm text-accent underline">
              Detail (důkaz, příklady) ↗
            </Link>
          </div>
        ) : (
          <Button variant="primary" className="mt-8 w-full py-3" onClick={() => setFlipped(true)}>
            Ukázat odpověď <span className="text-xs opacity-70">(mezerník)</span>
          </Button>
        )}
      </Card>
      {flipped && (
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {GRADES.map((g, k) => (
            <Button key={g.grade} variant={g.variant} className="flex-col py-3" onClick={() => grade(g.grade)}>
              <span>
                {g.label} <span className="text-xs opacity-60">({k + 1})</span>
              </span>
              <span className="text-xs font-normal opacity-75">{g.hint}</span>
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------------ Quiz

interface QuizEntry extends QuizQuestion {
  chapter_id: string;
  order: number[];
}

function Quiz({ chapterIds }: { chapterIds: string[] }) {
  const { user } = useAuth();
  const [qs, setQs] = useState<QuizEntry[] | null>(null);
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [wrong, setWrong] = useState<QuizEntry[]>([]);

  useEffect(() => {
    Promise.all(
      chapterIds.map((id) =>
        cached<QuizQuestion[]>(`/chapters/${id}/quiz`).then((list) => list.map((q) => ({ ...q, chapter_id: id }))),
      ),
    ).then((lists) =>
      setQs(
        shuffle(lists.flat())
          .slice(0, 10)
          .map((q) => ({ ...q, order: shuffle(q.options.map((_, k) => k)) })),
      ),
    );
  }, [chapterIds]);

  if (!qs) return <Spinner />;
  if (qs.length === 0) return <p className="text-muted">Pro vybrané kapitoly zatím nejsou kvízové otázky.</p>;
  if (i >= qs.length)
    return (
      <Card className="mx-auto max-w-3xl">
        <h2 className="text-xl font-semibold">
          Výsledek: {score} / {qs.length}
        </h2>
        {wrong.length > 0 && (
          <div className="mt-4">
            <h3 className="mb-2 font-semibold">Ke zopakování</h3>
            <ul className="space-y-3 text-sm">
              {wrong.map((q) => (
                <li key={q.id} className="rounded-lg bg-surface-2 p-3">
                  <Markdown>{q.question}</Markdown>
                  <div className="mt-1 text-ok">
                    ✓ <InlineMarkdown>{q.options[q.correct]}</InlineMarkdown>
                  </div>
                  {q.related.length > 0 && (
                    <div className="mt-1 flex gap-2">
                      {q.related.map((r) => (
                        <Link key={r} to={`/pojem/${r}`} className="text-accent underline">
                          {r}
                        </Link>
                      ))}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
        <Button variant="primary" className="mt-4" onClick={() => window.location.reload()}>
          Nový kvíz
        </Button>
      </Card>
    );

  const q = qs[i];
  const answered = picked !== null;
  function pick(k: number) {
    if (answered) return;
    setPicked(k);
    const ok = k === q.correct;
    if (ok) setScore((s) => s + 1);
    else setWrong((w) => [...w, q]);
    if (user) recordAttempt({ kind: "quiz", ref_id: q.id, chapter_id: q.chapter_id, correct: ok });
  }

  return (
    <div className="mx-auto max-w-3xl">
      {!user && <div className="mb-4"><LoginHint what="úspěšnost v kvízech" /></div>}
      <div className="mb-2 flex justify-between text-sm text-muted">
        <span>
          Otázka {i + 1} / {qs.length}
        </span>
        <span>správně {score}</span>
      </div>
      <Card className="animate-pop" key={q.id}>
        <Markdown className="text-lg">{q.question}</Markdown>
        <div className="mt-4 space-y-2">
          {q.order.map((k) => {
            const isCorrect = k === q.correct;
            const cls = !answered
              ? "border-line hover:border-accent hover:bg-accent-soft"
              : isCorrect
                ? "border-ok bg-ok-soft"
                : k === picked
                  ? "border-bad bg-bad-soft"
                  : "border-line opacity-60";
            return (
              <button key={k} onClick={() => pick(k)} disabled={answered} className={`block w-full rounded-lg border-2 px-4 py-3 text-left transition ${cls}`}>
                <InlineMarkdown>{q.options[k]}</InlineMarkdown>
              </button>
            );
          })}
        </div>
        {answered && (
          <div className={`mt-4 rounded-lg p-3 ${picked === q.correct ? "bg-ok-soft" : "bg-bad-soft"}`}>
            <p className="font-semibold">{picked === q.correct ? "Správně!" : "Špatně."}</p>
            {q.explanation && <Markdown className="mt-1 text-sm">{q.explanation}</Markdown>}
          </div>
        )}
        {answered && (
          <Button
            variant="primary"
            className="mt-4"
            onClick={() => {
              setPicked(null);
              setI((x) => x + 1);
            }}
          >
            {i + 1 < qs.length ? "Další otázka →" : "Výsledek"}
          </Button>
        )}
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------- Proof order

function ProofOrder({ chapterIds, itemId }: { chapterIds: string[]; itemId: string | null }) {
  const { user } = useAuth();
  const [pool, setPool] = useState<(Item & { chapter_id: string })[] | null>(null);
  const [idx, setIdx] = useState(0);
  const [order, setOrder] = useState<number[]>([]);
  const [checked, setChecked] = useState(false);
  const [dragFrom, setDragFrom] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      if (itemId) {
        const it = await cached<Item & { chapter: { id: string } }>(`/items/${itemId}`);
        setPool([{ ...it, chapter_id: it.chapter.id }]);
        return;
      }
      const chs = await loadChapters(chapterIds);
      setPool(shuffle(chs.flatMap((ch) => ch.items.filter((it) => it.proof_steps.length >= 3).map((it) => ({ ...it, chapter_id: ch.id })))));
    })();
  }, [chapterIds, itemId]);

  const item = pool?.[idx];
  useEffect(() => {
    if (!item) return;
    let o = shuffle(item.proof_steps.map((_, k) => k));
    if (o.every((v, k) => v === k)) o = [...o.slice(1), o[0]];
    setOrder(o);
    setChecked(false);
  }, [item]);

  const correctCount = useMemo(() => order.filter((v, k) => v === k).length, [order]);

  if (!pool) return <Spinner />;
  if (!item) return <p className="text-muted">Ve vybraných kapitolách nejsou důkazy s rozepsanými kroky.</p>;

  function move(from: number, to: number) {
    if (checked || to < 0 || to >= order.length) return;
    const o = [...order];
    const [x] = o.splice(from, 1);
    o.splice(to, 0, x);
    setOrder(o);
  }

  function check() {
    setChecked(true);
    const score = correctCount / order.length;
    if (user) recordAttempt({ kind: "proof", ref_id: item!.id, chapter_id: item!.chapter_id, correct: score === 1, score });
  }

  return (
    <div className="mx-auto max-w-3xl">
      {!user && <div className="mb-4"><LoginHint what="úspěšnost ve skládání důkazů" /></div>}
      <div className="mb-2 text-sm text-muted">
        Důkaz {idx + 1} / {pool.length}
      </div>
      <Card>
        <div className="mb-2 flex items-center gap-2">
          <KindBadge kind={item.kind} label={item.label} />
          <h2 className="text-lg font-semibold">{item.title}</h2>
        </div>
        <Statement item={item} />
        <p className="mt-4 mb-2 text-sm text-muted">Seřaď kroky důkazu do správného pořadí (přetažením nebo šipkami).</p>
        <ol className="space-y-2">
          {order.map((stepIdx, pos) => {
            const ok = checked && stepIdx === pos;
            const bad = checked && stepIdx !== pos;
            return (
              <li
                key={stepIdx}
                draggable={!checked}
                onDragStart={() => setDragFrom(pos)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (dragFrom !== null) move(dragFrom, pos);
                  setDragFrom(null);
                }}
                className={`flex items-start gap-2 rounded-lg border-2 bg-surface p-2 ${
                  ok ? "border-ok bg-ok-soft" : bad ? "border-bad bg-bad-soft" : "cursor-grab border-line"
                }`}
              >
                <span className="mt-0.5 w-6 shrink-0 text-center font-semibold text-muted">{pos + 1}.</span>
                <Markdown className="flex-1 text-sm [&_p]:my-0">{item.proof_steps[stepIdx]}</Markdown>
                {!checked && (
                  <span className="flex shrink-0 flex-col">
                    <button className="px-1 text-muted hover:text-ink" onClick={() => move(pos, pos - 1)} aria-label="Posunout nahoru">
                      ▲
                    </button>
                    <button className="px-1 text-muted hover:text-ink" onClick={() => move(pos, pos + 1)} aria-label="Posunout dolů">
                      ▼
                    </button>
                  </span>
                )}
                {bad && <span className="shrink-0 text-xs text-bad">patří na {stepIdx + 1}.</span>}
              </li>
            );
          })}
        </ol>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          {!checked ? (
            <Button variant="primary" onClick={check}>
              Zkontrolovat
            </Button>
          ) : (
            <>
              <span className={`font-semibold ${correctCount === order.length ? "text-ok" : "text-warn"}`}>
                Správně {correctCount} / {order.length}
              </span>
              <Link to={`/pojem/${item.id}`} className="text-sm text-accent underline">
                celý důkaz
              </Link>
              {idx + 1 < pool.length && (
                <Button variant="primary" onClick={() => setIdx((x) => x + 1)}>
                  Další důkaz →
                </Button>
              )}
              <Button
                onClick={() => {
                  setOrder(shuffle(item.proof_steps.map((_, k) => k)));
                  setChecked(false);
                }}
              >
                Zkusit znovu
              </Button>
            </>
          )}
        </div>
      </Card>
    </div>
  );
}
