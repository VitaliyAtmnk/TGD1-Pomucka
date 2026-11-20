import { Link, useParams } from "react-router-dom";
import { useApi } from "../api/client";
import type { ItemBrief, ItemDetail } from "../api/types";
import { ItemBody } from "../components/ItemView";
import { ErrorBox, KindBadge, Spinner, SupplementedBadge } from "../components/ui";

function ItemLinks({ title, items }: { title: string; items: ItemBrief[] }) {
  if (!items.length) return null;
  return (
    <section>
      <h3 className="mb-2 text-sm font-semibold tracking-wide text-muted uppercase">{title}</h3>
      <ul className="space-y-1">
        {items.map((it) => (
          <li key={it.id}>
            <Link to={`/pojem/${it.id}`} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-surface">
              <KindBadge kind={it.kind} label={it.label} />
              <span className="truncate">{it.title}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function ItemPage() {
  const { id = "" } = useParams();
  const { data: item, error, loading, reload } = useApi<ItemDetail>(`/items/${id}`, { cache: true });

  if (loading) return <Spinner />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  if (!item) return null;

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_260px]">
      <article className="min-w-0">
        <nav className="mb-3 text-sm text-muted">
          <Link to="/slovnik" className="hover:text-ink">
            Slovník
          </Link>{" "}
          /{" "}
          <Link to={`/kapitola/${item.chapter.id}`} className="hover:text-ink">
            {item.chapter.number}. {item.chapter.title}
          </Link>
          {item.section && <> / {item.section}</>}
        </nav>
        <header className="mb-5">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <KindBadge kind={item.kind} label={item.label} />
            {item.supplemented && <SupplementedBadge />}
            {item.exam_questions.map((q) => (
              <Link key={q} to={`/zkouska#otazka-${q}`} className="rounded-md bg-surface-2 px-1.5 py-0.5 text-xs font-medium text-muted hover:text-ink">
                otázka {q}
              </Link>
            ))}
          </div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{item.title}</h1>
          {item.terms.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {item.terms.map((t) => (
                <Link key={t} to={`/slovnik?q=${encodeURIComponent(t)}`} className="rounded-full border border-line px-2 py-0.5 text-xs text-muted hover:text-ink">
                  {t}
                </Link>
              ))}
            </div>
          )}
        </header>
        <ItemBody item={item} />
        {item.source && <p className="mt-6 text-xs text-muted">Zdroj: {item.source}</p>}
      </article>
      <aside className="space-y-6 lg:sticky lg:top-20 lg:self-start">
        <ItemLinks title="Související" items={item.related_items} />
        <ItemLinks title="Odkazuje sem" items={item.referenced_by} />
        <Link to={`/kapitola/${item.chapter.id}#${item.id}`} className="block text-sm text-accent underline">
          Zobrazit v kontextu kapitoly
        </Link>
      </aside>
    </div>
  );
}
