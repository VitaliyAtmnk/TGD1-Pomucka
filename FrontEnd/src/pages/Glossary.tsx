import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, useApi } from "../api/client";
import type { ChapterSummary, ItemBrief, ItemKind, SearchHit } from "../api/types";
import { Markdown } from "../components/Markdown";
import { KIND_LABEL, KindBadge, PageHeader, Segmented, Spinner, SupplementedBadge } from "../components/ui";

const KIND_FILTERS: { value: string; label: string }[] = [
  { value: "", label: "Vše" },
  { value: "definition", label: "Definice" },
  { value: "theorem", label: "Věty a tvrzení" },
  { value: "algorithm", label: "Algoritmy" },
];

function kindMatches(filter: string, kind: ItemKind) {
  if (!filter) return true;
  if (filter === "theorem") return ["theorem", "proposition", "lemma", "corollary"].includes(kind);
  return kind === filter;
}

function norm(s: string) {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

export function GlossaryPage() {
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  const kind = params.get("druh") ?? "";
  const chapter = params.get("kapitola") ?? "";
  const [view, setView] = useState<"abc" | "chapters">("abc");
  const items = useApi<ItemBrief[]>("/items", { cache: true });
  const chapters = useApi<ChapterSummary[]>("/chapters", { cache: true });
  const [hits, setHits] = useState<SearchHit[] | null>(null);
  const [input, setInput] = useState(q);

  useEffect(() => setInput(q), [q]);

  useEffect(() => {
    const t = setTimeout(() => {
      const next = new URLSearchParams(params);
      if (input.trim()) next.set("q", input.trim());
      else next.delete("q");
      if (next.toString() !== params.toString()) setParams(next, { replace: true });
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input]);

  useEffect(() => {
    if (!q) {
      setHits(null);
      return;
    }
    let alive = true;
    api<SearchHit[]>(`/search?q=${encodeURIComponent(q)}&limit=60`)
      .then((h) => alive && setHits(h))
      .catch(() => alive && setHits([]));
    return () => {
      alive = false;
    };
  }, [q]);

  function setFilter(key: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  }

  const filtered = useMemo(() => {
    const list = (items.data ?? []).filter((it) => kindMatches(kind, it.kind) && (!chapter || it.chapter.id === chapter));
    return [...list].sort((a, b) => a.title.localeCompare(b.title, "cs"));
  }, [items.data, kind, chapter]);

  const groups = useMemo(() => {
    const m = new Map<string, ItemBrief[]>();
    if (view === "abc") {
      for (const it of filtered) {
        const letter = norm(it.title).replace(/[^a-z]/g, "").charAt(0).toUpperCase() || "#";
        m.set(letter, [...(m.get(letter) ?? []), it]);
      }
      return [...m.entries()].sort(([a], [b]) => a.localeCompare(b, "cs"));
    }
    for (const it of [...filtered].sort((a, b) => a.chapter.number - b.chapter.number || (a.section ?? "").localeCompare(b.section ?? "", undefined, { numeric: true }))) {
      const key = `${it.chapter.number}. ${it.chapter.title}`;
      m.set(key, [...(m.get(key) ?? []), it]);
    }
    return [...m.entries()];
  }, [filtered, view]);

  const visibleHits = hits?.filter((h) => kindMatches(kind, h.kind) && (!chapter || h.chapter.id === chapter));

  return (
    <div>
      <PageHeader title="Slovník" subtitle={`${items.data?.length ?? "…"} definic, vět a algoritmů ze všech kapitol`} />
      <div className="mb-5 space-y-3">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Hledej pojem, např. „kvazikomponenta“, „ford“, „np uplny“…"
          className="w-full rounded-xl border border-line bg-surface px-4 py-3 text-base outline-none focus:border-accent"
          autoFocus
          aria-label="Hledat ve slovníku"
        />
        <div className="flex flex-wrap items-center gap-3">
          <Segmented value={kind} onChange={(v) => setFilter("druh", v)} options={KIND_FILTERS} />
          <select
            value={chapter}
            onChange={(e) => setFilter("kapitola", e.target.value)}
            className="rounded-lg border border-line bg-surface px-2 py-2 text-sm"
            aria-label="Kapitola"
          >
            <option value="">Všechny kapitoly</option>
            {chapters.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.number}. {c.title}
              </option>
            ))}
          </select>
          {!q && (
            <Segmented
              value={view}
              onChange={setView}
              options={[
                { value: "abc", label: "Abecedně" },
                { value: "chapters", label: "Podle kapitol" },
              ]}
            />
          )}
        </div>
      </div>

      {items.loading && <Spinner />}

      {q ? (
        visibleHits === undefined ? (
          <Spinner label="Hledám…" />
        ) : visibleHits.length === 0 ? (
          <p className="text-muted">Nic nenalezeno pro „{q}“.</p>
        ) : (
          <ul className="space-y-3">
            {visibleHits.map((h) => (
              <li key={h.id}>
                <Link to={`/pojem/${h.id}`} className="block rounded-xl border border-line bg-surface p-4 transition hover:border-accent">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <KindBadge kind={h.kind} label={h.label} />
                    <span className="font-semibold">{h.title}</span>
                    {h.supplemented && <SupplementedBadge />}
                    <span className="ml-auto text-xs text-muted">
                      kap. {h.chapter.number}: {h.chapter.title}
                    </span>
                  </div>
                  <div className="line-clamp-3 text-sm text-muted">
                    <Markdown>{h.statement}</Markdown>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )
      ) : (
        <div className="space-y-6">
          {groups.map(([group, list]) => (
            <section key={group}>
              <h2 className="sticky top-14 z-10 mb-2 bg-bg/95 py-1 text-lg font-bold text-muted">{group}</h2>
              <ul className="grid gap-x-6 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
                {list.map((it) => (
                  <li key={it.id}>
                    <Link to={`/pojem/${it.id}`} className="group flex items-baseline gap-2 rounded-md px-2 py-1 hover:bg-surface">
                      <span className="w-2 shrink-0 self-center">
                        <span
                          className="block h-2 w-2 rounded-full"
                          style={{ background: `var(--k-${["theorem", "proposition"].includes(it.kind) ? "theorem" : ["lemma", "corollary"].includes(it.kind) ? "lemma" : it.kind})` }}
                          title={KIND_LABEL[it.kind]}
                        />
                      </span>
                      <span className="group-hover:text-accent">{it.title}</span>
                      {it.illustrations > 0 && (
                        <span className="shrink-0 rounded-sm bg-mark-soft px-1 font-mono text-[0.68rem] font-semibold" title="Má krokovanou ilustraci">
                          ilustrace
                        </span>
                      )}
                      <span className="ml-auto shrink-0 text-xs text-muted">
                        {it.label ?? KIND_LABEL[it.kind]}
                        {view === "abc" && ` · k${it.chapter.number}`}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
