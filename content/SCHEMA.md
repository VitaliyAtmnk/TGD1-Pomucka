# Formát studijního obsahu

Veškerý obsah (definice, věty, důkazy, algoritmy, příklady, kvízové otázky) je uložen
v YAML souborech v adresáři `content/`. Backend je při startu načte, zvaliduje
(Pydantic) a servíruje přes API. Opravy obsahu tedy stačí poslat jako pull request.

```
content/
  chapters/NN-slug.yaml   # jedna kapitola = jeden soubor
  exam.yaml               # otázky k ústní zkoušce (vazba na položky kapitol)
```

## Text, matematika

* Všechna textová pole jsou **Markdown** s matematikou v **KaTeX** syntaxi:
  inline `$x_{ij} \le r_{ij}$`, blokově `$$ ... $$` (na samostatných řádcích).
* Víceřádkové texty piš jako YAML blokový literál `|` – pak není nutné escapovat
  zpětná lomítka. Jednořádkové řetězce s `$`, `:` nebo `#` dej do uvozovek
  (a pak v nich zdvoj zpětná lomítka), nebo také použij `|`.
* Orientovaný graf značíme `\vec{G}`, množinu uzlů `U(G)`, hran `H(G)`
  (stejně jako ve skriptech).
* Odkaz na jinou položku: `[tok](#def-tok)` – frontend z toho udělá proklik.
* Jazyk: čeština.

## Kapitola

```yaml
id: toky                     # slug kapitoly (unikátní)
number: 2                    # pořadí v aplikaci
title: Toky v sítích
source: "TGD1 skripta kap. 2 (str. 5–11); přednášky 3–4"
exam_questions: [6, 7]       # čísla otázek z otazky.pdf, které kapitola pokrývá
summary: |
  2–4 věty: o čem kapitola je a proč je důležitá.
sections:
  - number: "2.1"
    title: Síť, existence toku v síti
items: [...]                 # viz níže
quiz: [...]                  # viz níže
```

## Položka (`items[]`)

```yaml
- id: def-sit                # globálně unikátní slug, prefix podle druhu:
                             #   def- thm- prop- lemma- cor- alg- rem- ex-
  kind: definition           # definition | theorem | proposition | lemma |
                             # corollary | algorithm | remark
  label: "Definice 2.1"      # číslování ze skript/přednášek (pokud existuje)
  section: "2.1"             # číslo sekce kapitoly
  title: Síť                 # krátký název (u definic = definovaný pojem)
  terms: [síť, intenzita uzlu, propustnost hrany]  # hesla pro vyhledávání
  statement: |               # přesné znění (povinné)
    ...
  intuition: |               # neformální vysvětlení „lidsky", proč to platí /
    ...                      # k čemu to je (doporučeno u všeho podstatného)
  proof: |                   # důkaz (povinné u theorem/proposition/lemma/corollary,
    ...                      # pokud ho zdroj má; jinak doplnit a dát supplemented)
  proof_steps:               # 3–8 hlavních kroků důkazu ve správném pořadí –
    - Krok 1 ...             # používá se pro cvičení „seřaď důkaz"
    - Krok 2 ...             # (každý krok samostatně srozumitelný, 1–2 věty)
  pseudocode: |              # u algoritmů: kroky algoritmu (Markdown seznam)
    ...
  complexity: "$O(n^3)$"     # u algoritmů / tvrzení o složitosti
  examples:                  # řešené příklady (doporučeno)
    - title: Maximální tok v malé síti
      body: |
        ...
      graph:                 # volitelně: graf k vykreslení (viz formát grafu)
        directed: true
        nodes: [...]
        edges: [...]
  visualization: max-flow    # volitelně: id interaktivní vizualizace (seznam níže)
  related: [def-tok, thm-ford-fulkerson]   # související položky (id)
  source: "skripta str. 5"   # kde je to ve zdroji
  supplemented: false        # true = doplněno mimo materiály TGD1 (skripta/folie)
```

## Formát grafu (příklady, vizualizace, editor)

```yaml
graph:
  directed: true
  nodes:
    - { id: z, x: 0, y: 2 }         # x, y volitelné (souřadnice v mřížce ~0–10);
    - { id: a, x: 2, y: 0 }         # bez nich se použije automatické rozložení
    - { id: s, x: 4, y: 2, a: -3 }  # libovolné další atributy (např. intenzita a)
  edges:
    - { from: z, to: a, w: 2 }      # w = váha / propustnost
    - { from: a, to: s, w: 3, x: 1 } # další atributy (např. tok x)
```

## Kvízová otázka (`quiz[]`)

```yaml
- id: q-toky-01
  question: |
    Která podmínka **není** součástí definice toku v síti?
  options:
    - "$0 \\le x_{ij} \\le r_{ij}$ pro každou hranu"
    - Zákon zachování v každém uzlu
    - "$x_{ij} = x_{ji}$ pro každou dvojici uzlů"
    - Nezápornost toku
  correct: 2                 # index správné možnosti (od 0)
  explanation: |
    Proč je to tak (zobrazí se po odpovědi).
  related: [def-tok]
```

Rozumné rozsahy: 8–15 otázek na kapitolu, 4 možnosti, otázky prověřující
**porozumění** (ne jen doslovné znění) – včetně složitostí algoritmů, protipříkladů
a „co by se stalo, kdyby…".

## Ilustrace pojmů a důkazů (`items[].illustrations`)

Krátká krokovaná ukázka na malém grafu k definici, větě nebo důkazu. Aplikace u každého
kroku sama vyhodnotí zvolenou **vlastnost** (např. „je graf acyklický?“), ukáže verdikt a
svědka (nalezený cyklus, nepokrytou hranu…). Po krocích si čtenář může graf upravovat sám
(„Vyzkoušej sám“) a vlastnost se přepočítává.

```yaml
illustrations:
  - title: Jedna hrana navíc a acykličnost je pryč   # krátký název ukázky
    for: statement            # statement (u znění) | proof (u důkazu)
    property: acyclic         # volitelné, viz tabulka níže
    graph:                    # výchozí graf (formát grafu výše); id uzlů bez znaku "-"
      directed: true
      nodes: [{ id: a, x: 0, y: 5 }, { id: b, x: 3, y: 1.5 }, ...]
      edges: [{ from: a, to: b }, ...]
    steps:                    # 1–7 kroků
      - caption: |            # Markdown + KaTeX, 1–3 věty: co vidíme a PROČ
          Všechny hrany vedou zleva doprava – graf je acyklický.
      - caption: Přidáme hranu $f \to a$ …
        add: [[f, a]]         # přidané hrany (kumulativně pro další kroky), volitelně [od, do, váha]
        remove: [[d, f]]      # odebrané hrany (kumulativně)
        nodes: { a: active }  # zvýraznění uzlů jen v tomto kroku (stavy níže)
        edges: { a-b: path }  # zvýraznění hran jen v tomto kroku, klíč "od-do"
        labels: { a: "d=2" }  # popisky pod uzly jen v tomto kroku
        edge_labels: { a-b: "2/3" } # popisky hran jen v tomto kroku (např. tok x/r)
        set: [a, c]           # vybrané uzly (pro vlastnosti nad množinou uzlů)
        edge_set: [a-b, b-c]  # vybrané hrany (pro vlastnosti nad množinou hran)
        colors: { a: 0, b: 1 } # barvy uzlů 0–7 (pro proper-coloring)
        witness: true         # vykreslit svědka vlastnosti i přes ruční zvýraznění
    interactive: true         # režim „Vyzkoušej sám“ (výchozí: ano, pokud je property)
```

Stavy uzlů: `default active frontier visited done source sink rejected path`.
Stavy hran: `default active considered tree rejected path cut back dim hidden`.
Bez ručního zvýraznění (`nodes`/`edges`) se automaticky kreslí svědek vlastnosti.

| property | výběr | co se kontroluje |
|----------|-------|------------------|
| `acyclic` | – | orientovaný: bez cyklu; neorientovaný: bez kružnice (svědek = cyklus) |
| `connected` | – | (slabá) souvislost, svědek = komponenty barevně |
| `strongly-connected` | – | silná souvislost, svědek = kvazikomponenty |
| `tree` | – | souvislý bez kružnic |
| `bipartite` | – | 2-obarvitelnost, svědek = lichá kružnice |
| `eulerian` | – | souvislý se sudými stupni, svědek = liché uzly |
| `hamiltonian` | – | existence hamiltonovské kružnice (do 11 uzlů) |
| `complete` | – | úplný graf |
| `independent-set` | uzly (`set`) | žádná hrana uvnitř množiny |
| `vertex-cover` | uzly | každá hrana má konec v množině |
| `clique` | uzly | každé dva vybrané uzly sousedí |
| `dominating-set` | uzly | každý uzel mimo množinu sousedí s množinou (orientovaně: vede z něj hrana do množiny) |
| `kernel` | uzly | nezávislá + dominantní |
| `separating-set` | uzly | odebrání množiny graf rozpojí (artikulace, uzlový řez) |
| `disconnecting-edges` | hrany (`edge_set`) | odebrání hran graf rozpojí (most, hranový řez) |
| `spanning-tree` | hrany | vybrané hrany tvoří kostru |
| `matching` | hrany | vybrané hrany tvoří párování (pozná i perfektní) |
| `proper-coloring` | barvy (`colors`) | sousední uzly mají různé barvy |

Kontrola: `ILLUSTRATION_REPORT=1 npx vitest run src/viz/illustrations.test.ts` (ve složce
`FrontEnd`) vypíše u každého kroku verdikt vlastnosti vedle popisku.

## Id interaktivních vizualizací

Hodnota `visualization` musí být jedna z těchto (frontend ukáže „připravujeme",
pokud ještě není implementovaná):

| id | co vizualizuje |
|----|----------------|
| `graph-search` | prohledávání do šířky / hloubky (BFS, DFS) |
| `dijkstra` | Dijkstrův algoritmus |
| `mst` | minimální kostra (Kruskal, Jarník/Prim) |
| `floyd` | Floydův algoritmus, distanční matice |
| `critical-path` | kritická cesta v acyklickém grafu, topologické uspořádání |
| `scc` | kvazikomponenty (silné komponenty) a kondenzace |
| `max-flow` | Ford–Fulkerson / Edmonds–Karp, rezervní polocesty, min. řez |
| `matrix-reducibility` | rozložitelnost matice přes diagram a kvazikomponenty |
| `bipartite-matching` | párování v bigrafu, stabilní množina |
| `blocks` | mosty, artikulace, bloky |
| `euler` | eulerovský tah |
| `hamilton-backtracking` | backtracking pro hamiltonovské cesty/kružnice |
| `bondy-chvatal` | uzávěr grafu (Bondy–Chvátal) |
| `independent-set` | nezávislé množiny, pokrytí, kliky, dominance |
| `kernel` | jádro orientovaného grafu |
| `coloring` | barvení grafu (hladový algoritmus, backtracking) |
| `two-sat` | 2-SAT přes implikační graf a kvazikomponenty |
| `reduction-3sat-ind` | redukce 3-SAT → IND |
| `reduction-3sat-3col` | redukce 3-SAT → 3-COL |
| `vertex-cover-fpt` | FPT algoritmus pro vrcholové pokrytí (omezený strom hledání) |

## Ústní zkouška (`exam.yaml`)

```yaml
questions:
  - number: 6
    title: Síť, tok, existence toku v síti
    group: 1                    # 1 = otázky 1–10, 2 = otázky 11–20
    chapters: [toky]
    items: [def-sit, def-tok, thm-existence-toku]   # co je nutné umět
    outline: |                  # osnova odpovědi (Markdown seznam)
      ...
    algorithms: |               # algoritmy a jejich složitost (důraz u zkoušky!)
      ...
    example_tasks: |            # typické doplňující dotazy / příklady
      ...
```
