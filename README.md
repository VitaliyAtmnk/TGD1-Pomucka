# TGD1 – studijní portál

### URL hostované aplikace: **[TGD1 - Portal](https://grafy.dargr.eu/)**

Webová aplikace pro studium předmětu **KMA/TGD1 – Teorie grafů, diskrétní optimalizace a výpočetní složitost 1** (ZČU).

* **Slovník** všech definic, vět, tvrzení a algoritmů s vyhledáváním bez diakritiky a informací, ke které kapitole patří.
* **Důkazy** u všech vět, s rozpisem struktury důkazu a intuicí.
* **Ilustrace pojmů a důkazů** (128 u 116 položek): krokované ukázky na malých grafech, u kterých aplikace živě
  kontroluje vlastnost (acyklický, silně souvislý, nezávislá množina, jádro, obarvení…) a ukazuje svědka.
  Režim „Vyzkoušej sám“ dovolí graf nebo výběr upravovat. Formát viz `content/SCHEMA.md`.
* **Interaktivní vizualizace** 19 algoritmů s krokováním, pseudokódem a editorem grafů: minimální kostra, Dijkstra,
  eulerovský tah, kvazikomponenty, kritická cesta, maximální tok, Floyd, rozložitelnost matice, párování v bigrafu,
  BFS/DFS, bloky a artikulace, backtracking pro hamiltonovskou kružnici, uzávěr grafu, nezávislé množiny, jádro,
  barvení, 2-SAT, redukce 3-SAT → IND a FPT vrcholové pokrytí.
* Vzhled „papír“ (světlý) a „tabule“ (tmavý), písma hostovaná lokálně (žádné požadavky na Google Fonts).
* **Opakování podle kapitol**: kartičky s rozloženým opakováním (SM-2), kvízy, skládání důkazů.
* **Generované příklady** (max. tok, Floyd, kostra, Dijkstra, kritická cesta, rozložitelnost matice, α(G), χ(G), 2-SAT)
  s automatickou kontrolou a řešením.
* **Příprava na ústní zkoušku**: 20 otázek s osnovou, algoritmy a složitostmi, losování a sebehodnocení.
* **Účty a sledování pokroku** po kapitolách.

## Architektura

```
FrontEnd/   React 18 + TypeScript + Vite + Tailwind 4, KaTeX; nginx v produkci (servíruje SPA a proxy /api)
Backend/    Python 3.12 + FastAPI + SQLAlchemy; JWT autentizace; generátory příkladů (networkx)
Database/   PostgreSQL 16 (uživatelé, stav kartiček, pokusy, uložené grafy)
content/    studijní obsah v YAML (Markdown + KaTeX) – viz content/SCHEMA.md
```

Obsah je verzovaný v repozitáři, backend ho při startu načte a zvaliduje. Databáze obsahuje jen uživatelská data.

## Lokální spuštění (Docker)

```bash
cp .env.example .env        # a změň hesla / JWT_SECRET
docker compose up -d --build
```

Aplikace poběží na <http://localhost:8080>. API dokumentace (Swagger) je na <http://localhost:8080/api/docs>
(přes nginx) – resp. přímo na backendu.

Testy backendu + striktní validace obsahu:

```bash
docker compose --profile test run --rm backend-test
```

## Vývoj bez Dockeru

```bash
# databáze
docker compose up -d database      # nebo vlastní PostgreSQL

# backend (Python 3.12)
cd Backend
pip install -r requirements-dev.txt
DATABASE_URL=postgresql+psycopg://tgd:tgd@localhost:5432/tgd uvicorn app.main:app --reload
pytest

# frontend
cd FrontEnd
npm install
npm run dev        # http://localhost:5173, /api je proxováno na :8000
npm test           # testy algoritmů vizualizací
```

## Úpravy obsahu

1. Uprav YAML v `content/chapters/` (formát popisuje [content/SCHEMA.md](content/SCHEMA.md)).
2. Ověř: `docker compose --profile test run --rm backend-test` (nebo `python -m app.content.validate ../content`).
3. Pošli pull request.

Položky označené `supplemented: true` (v aplikaci štítek *doplněno*) nepocházejí z materiálů předmětu
(skripta a folie Z. Ryjáčka), ale ze standardní literatury – např. kapitola o FPT algoritmech.

## Autorství obsahu

Obsah vychází z pracovních textů přednášek *KMA/TGD1 – Teorie grafů a diskrétní optimalizace 1* a folií
Z. Ryjáčka (KMA FAV ZČU). Definice a věty zachovávají číslování skript kvůli orientaci, doprovodné texty, intuice
a důkazy jsou přeformulované. Jde o neoficiální studijní pomůcku.
