import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useApi } from "../api/client";
import type { ChapterSummary, ExamQuestion } from "../api/types";
import { GraphView } from "../components/GraphView";
import { Markdown } from "../components/Markdown";
import { KindBadge, SupplementedBadge } from "../components/ui";
import { ALGORITHMS } from "../viz/algorithms";
import { maxFlow } from "../viz/algorithms/flow";
import { PRESETS } from "../viz/presets";

const REPO_URL = import.meta.env.VITE_REPO_URL as string | undefined;

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

/** Hero demo: Edmonds–Karp running on the network from the lecture notes (section 2.4). */
function FlowDemo() {
  const steps = useMemo(() => maxFlow.run(PRESETS.flow, { source: "z", sink: "s", mode: "bfs" }), []);
  const [i, setI] = useState(() => (prefersReducedMotion() ? steps.length - 1 : 0));
  const [playing, setPlaying] = useState(() => !prefersReducedMotion());

  useEffect(() => {
    if (!playing) return;
    const t = setTimeout(() => setI((x) => (x + 1) % steps.length), i === steps.length - 1 ? 4200 : 1700);
    return () => clearTimeout(t);
  }, [playing, i, steps.length]);

  const step = steps[i];
  return (
    <figure className="relative">
      <div className="rounded-lg border border-line bg-surface p-2 shadow-[4px_4px_0_0_var(--surface-2)]">
        <GraphView
          graph={PRESETS.flow}
          nodeStyles={step.nodes}
          edgeStyles={step.edges}
          showWeights
          className="max-h-[340px]"
          ariaLabel="Ukázka: maximální tok v síti ze skript"
        />
        <div className="flex items-center gap-3 border-t border-line px-2 pt-2 pb-1">
          <button
            onClick={() => setPlaying((p) => !p)}
            className="rounded-sm border border-line px-2 py-0.5 font-mono text-xs font-semibold hover:border-accent"
            aria-label={playing ? "Pozastavit ukázku" : "Spustit ukázku"}
          >
            {playing ? "pauza" : "přehrát"}
          </button>
          <span className="font-mono text-xs text-muted tabular-nums">
            krok {i + 1}/{steps.length}
          </span>
          <Link to="/vizualizace/max-flow" className="ml-auto text-sm font-semibold text-accent">
            otevřít vizualizaci →
          </Link>
        </div>
      </div>
      <figcaption className="mt-3 min-h-[4.5rem] text-[0.95rem] text-muted" aria-live="polite">
        <Markdown>{step.message}</Markdown>
      </figcaption>
      {/* margin notes, as written next to a lecture example */}
      <p className="hand pointer-events-none absolute -top-9 right-4 hidden rotate-[-4deg] text-[1.45rem] leading-none text-accent md:block" aria-hidden="true">
        příklad ze skript, odd. 2.4
        <svg viewBox="0 0 60 30" className="ml-auto block h-6 w-12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M50 3 C 44 18, 30 24, 12 26" />
          <path d="M12 26 l7 -6 M12 26 l8 3" />
        </svg>
      </p>
      <p className="hand pointer-events-none absolute top-[58%] left-5 hidden rotate-[-5deg] text-[1.35rem] leading-tight whitespace-nowrap text-bad md:block" aria-hidden="true">
        max. tok = min. řez = 4
      </p>
    </figure>
  );
}

const FEATURES = [
  {
    title: "Slovník",
    to: "/slovnik",
    text: "Každá definice, věta a algoritmus s číslem ze skript a kapitolou, kam patří. Hledání funguje i bez diakritiky – „np uplny“ najde NP-úplný jazyk.",
  },
  {
    title: "Vizualizace",
    to: "/vizualizace",
    text: "Algoritmy, které můžeš krokovat dopředu i zpět, s pseudokódem a stavem v každém kroku. Graf si můžeš nakreslit vlastní.",
  },
  {
    title: "Opakování podle kapitol",
    to: "/opakovani",
    text: "Kartičky s rozloženým opakováním, kvízy na porozumění a skládání důkazů ze zpřeházených kroků.",
  },
  {
    title: "Příprava na zkoušku",
    to: "/zkouska",
    text: "Všech 20 otázek k ústní zkoušce s osnovou odpovědi, algoritmy a jejich složitostí. Generované příklady jako u písemky.",
  },
];

const STEPS = [
  { title: "Přečti kapitolu", text: "Definice a věty jsou seřazené jako ve skriptech, ke každé větě je intuice a důkaz." },
  { title: "Opakuj kartičky", text: "Aplikace sama plánuje, kdy kterou kartičku zopakovat, aby ti látka zůstala v hlavě." },
  { title: "Procvič příklady a důkazy", text: "Náhodně generované úlohy s okamžitou kontrolou a řešením, pořadí kroků důkazů." },
  { title: "Nasimuluj ústní zkoušku", text: "Vylosuj dvě otázky, připrav si odpověď, porovnej ji s osnovou a ohodnoť se." },
];

export function LandingPage() {
  const location = useLocation();
  useEffect(() => {
    if (location.hash) setTimeout(() => document.getElementById(location.hash.slice(1))?.scrollIntoView(), 60);
  }, [location.hash]);
  const chapters = useApi<ChapterSummary[]>("/chapters", { cache: true });
  const exam = useApi<ExamQuestion[]>("/exam", { cache: true });
  const items = chapters.data?.reduce((a, c) => a + c.item_count, 0);
  const quiz = chapters.data?.reduce((a, c) => a + c.quiz_count, 0);

  const stats = [
    { n: chapters.data?.length, label: "kapitol" },
    { n: items, label: "definic, vět a algoritmů" },
    { n: quiz, label: "kvízových otázek" },
    { n: exam.data?.length, label: "otázek ke zkoušce" },
    { n: ALGORITHMS.length, label: "krokovaných algoritmů" },
  ];

  return (
    <div className="space-y-20 sm:space-y-28">
      {/* ------------------------------------------------------------ hero */}
      <section className="grid items-center gap-10 pt-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:gap-14">
        <div className="min-w-0">
          <p className="label-caps mb-4">KMA/TGD1 · Fakulta aplikovaných věd ZČU v Plzni</p>
          <h1 className="text-[2.6rem] leading-[1.02] font-extrabold sm:text-[3.6rem]">
            Teorie grafů
            <br />
            <span className="hl">krok za krokem</span>
          </h1>
          <p className="mt-5 max-w-[56ch] text-[1.12rem] leading-relaxed text-muted">
            Studijní portál k předmětu <em>Teorie grafů, diskrétní optimalizace a výpočetní složitost 1</em>. Definice a věty
            z přednášek na jednom místě, důkazy s rozepsanou strukturou, algoritmy, které si můžeš proklikat, a příprava na
            písemku i ústní zkoušku.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link to="/prehled" className="rounded-md bg-accent px-5 py-2.5 font-semibold text-accent-ink hover:brightness-110">
              Začít studovat
            </Link>
            <Link to="/slovnik" className="rounded-md border border-line bg-surface px-5 py-2.5 font-semibold hover:border-accent">
              Otevřít slovník
            </Link>
          </div>
          <dl className="mt-9 grid max-w-xl grid-cols-3 gap-x-6 gap-y-4 sm:grid-cols-5">
            {stats.map((s) => (
              <div key={s.label}>
                <dt className="sr-only">{s.label}</dt>
                <dd className="font-display text-2xl leading-none font-bold tabular-nums">{s.n ?? "–"}</dd>
                <dd className="mt-1 text-[0.82rem] leading-snug text-muted">{s.label}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="min-w-0 pt-8 lg:pt-0">
          <FlowDemo />
        </div>
      </section>

      {/* -------------------------------------------------------- features */}
      <section aria-labelledby="co-tu-je">
        <h2 id="co-tu-je" className="mb-6 text-[1.9rem] font-bold">
          Co tu najdeš
        </h2>
        <div className="grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-2">
          {FEATURES.map((f) => (
            <Link key={f.to} to={f.to} className="group bg-surface p-5 transition hover:bg-[color-mix(in_srgb,var(--accent)_5%,var(--surface))] sm:p-6">
              <h3 className="text-[1.25rem] font-bold group-hover:text-accent">{f.title} →</h3>
              <p className="mt-2 max-w-[52ch] text-muted">{f.text}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------ how */}
      <section aria-labelledby="jak">
        <h2 id="jak" className="mb-6 text-[1.9rem] font-bold">
          Jak se s portálem učit
        </h2>
        <ol className="grid gap-6 md:grid-cols-4">
          {STEPS.map((s, k) => (
            <li key={s.title} className="border-t-2 border-ink pt-3">
              <span className="font-mono text-sm font-semibold text-muted">krok {k + 1}</span>
              <h3 className="mt-1 text-[1.1rem] font-bold">{s.title}</h3>
              <p className="mt-1.5 text-[0.97rem] text-muted">{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* -------------------------------------------------------- exam */}
      <section aria-labelledby="zkouska" className="grid gap-8 rounded-lg border border-line bg-surface p-6 sm:p-8 md:grid-cols-[1fr_1fr]">
        <div>
          <h2 id="zkouska" className="text-[1.6rem] font-bold">
            Zkouška v kostce
          </h2>
          <p className="mt-2 text-muted">Podle zveřejněných otázek ke zkoušce (rok 2023).</p>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <h3 className="label-caps">Písemná část</h3>
            <p className="mt-1.5">2 vyučovací hodiny, 3 příklady. K ústní části je potřeba mít aspoň 2 správně. Skripta a vlastní materiály jsou povolené.</p>
          </div>
          <div>
            <h3 className="label-caps">Ústní část</h3>
            <p className="mt-1.5">
              2 otázky: jedna z 1.–10., jedna z 11.–20. Hlavní důraz je na <span className="hl">algoritmy a jejich složitost</span>.
            </p>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------- sources */}
      <section id="zdroje" aria-labelledby="zdroje-h" className="scroll-mt-24">
        <h2 id="zdroje-h" className="mb-6 text-[1.9rem] font-bold">
          Odkud je obsah
        </h2>
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="space-y-4">
            <p className="max-w-[62ch]">
              Látka vychází z materiálů předmětu KMA/TGD1 Katedry matematiky FAV Západočeské univerzity v Plzni:
            </p>
            <ul className="space-y-3">
              <li className="rounded-md border border-line bg-surface px-4 py-3">
                <span className="font-semibold">Z. Ryjáček: Teorie grafů a diskrétní optimalizace 1 – pracovní texty přednášek</span>
                <span className="block text-sm text-muted">KMA FAV ZČU, 2007, opravená verze 2011 · kapitoly 1–9</span>
              </li>
              <li className="rounded-md border border-line bg-surface px-4 py-3">
                <span className="font-semibold">Folie z přednášek KMA/TGD1</span>
                <span className="block text-sm text-muted">12 přednášek · včetně opakování látky z KMA/DMA (grafy, stromy, metrika, orientované grafy)</span>
              </li>
              <li className="rounded-md border border-line bg-surface px-4 py-3">
                <span className="font-semibold">Otázky ke zkoušce</span>
                <span className="block text-sm text-muted">rok 2023 · 20 otázek ústní části</span>
              </li>
            </ul>
            <p className="max-w-[62ch] text-sm text-muted">
              Portál je neoficiální studijní pomůcka studentů. Katedra matematiky ho nevydává ani neschvaluje. Při jakémkoli
              rozporu platí skripta a výklad na přednášce.
            </p>
          </div>

          <div className="space-y-5">
            <div>
              <h3 className="text-[1.15rem] font-bold">Jak je obsah zpracovaný</h3>
              <ul className="mt-2 space-y-2.5 text-[0.98rem]">
                <li>
                  <KindBadge kind="theorem" label="Věta 2.2" /> Definice a věty jsou matematicky přesné a mají stejné číslo
                  jako ve skriptech, takže se v nich snadno zorientuješ.
                </li>
                <li>Doprovodné texty, intuice a důkazy jsou napsané vlastními slovy. Kde důkaz ve skriptech chybí nebo je jen naznačený, je dopsaný a na začátku je to uvedené.</li>
                <li>Kde se skripta a folie liší nebo obsahují překlep, text to výslovně zmiňuje.</li>
                <li>Texty vznikly s pomocí AI a byly porovnány se skripty. Přesto v nich mohou být chyby.</li>
              </ul>
            </div>
            <div className="rounded-md border border-dashed border-warn/60 bg-warn-soft/50 px-4 py-3">
              <p>
                <SupplementedBadge /> <span className="ml-1">Položka s tímto štítkem není v materiálech předmětu.</span>
              </p>
              <p className="mt-2 text-[0.95rem] text-muted">
                Je doplněná ze standardní literatury, protože ji potřebuješ k pochopení nebo ke zkoušce. Celá je doplněná
                kapitola o FPT algoritmech (otázka 20), kterou skripta ani dostupné folie nepokrývají. Zdroj: M. Cygan a kol.,
                <em> Parameterized Algorithms</em>, Springer 2015.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ----------------------------------------------------- report error */}
      <section id="chyba" className="scroll-mt-24 border-t border-line pt-8">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <div>
            <h2 className="text-[1.5rem] font-bold">Našel jsi chybu?</h2>
            <p className="mt-1 max-w-[62ch] text-muted">
              Obsah je uložený jako textové soubory ve veřejném repozitáři. Opravu můžeš poslat jako pull request, nebo chybu
              popsat v issue – stačí uvést, o kterou položku jde (např. „Věta 2.2“).
            </p>
          </div>
          {REPO_URL && (
            <a href={REPO_URL} target="_blank" rel="noreferrer noopener" className="rounded-md border border-line bg-surface px-4 py-2 font-semibold hover:border-accent">
              Repozitář na GitHubu ↗
            </a>
          )}
        </div>
      </section>
    </div>
  );
}
