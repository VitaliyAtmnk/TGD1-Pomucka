"""Randomly generated, automatically checked exercises.

Every exercise is a pure function of (type, seed, difficulty), so the server does not have to
store generated tasks: `check` simply regenerates the task and compares the answer.
"""

from __future__ import annotations

import itertools
import math
import random
import string
from dataclasses import dataclass
from typing import Any, Callable

import networkx as nx

INF = math.inf


@dataclass
class Task:
    prompt: str  # Markdown + KaTeX
    answer_spec: dict[str, Any]  # tells the frontend which input to render
    data: dict[str, Any]  # graph / matrix / formula for rendering
    solution: Any  # canonical answer (internal)
    explanation: str  # Markdown, shown after checking


@dataclass
class Exercise:
    id: str
    title: str
    chapter: str
    description: str
    build: Callable[[random.Random, int], Task]
    check: Callable[[Task, Any], tuple[bool, float]]


# ----------------------------------------------------------------- helpers


def _graph_json(g: nx.Graph, pos: dict, weight: str | None = "w", directed: bool = False, **extra) -> dict:
    nodes = [{"id": str(n), "x": round(pos[n][0], 2), "y": round(pos[n][1], 2)} for n in g.nodes]
    edges = []
    for u, v, d in g.edges(data=True):
        e = {"from": str(u), "to": str(v)}
        if weight and weight in d:
            e["w"] = d[weight]
        edges.append(e)
    return {"graph": {"directed": directed, "nodes": nodes, "edges": edges, **extra}}


def _circle_pos(nodes: list, r: float = 4.0, cx: float = 5.0, cy: float = 5.0) -> dict:
    n = len(nodes)
    return {
        v: (cx + r * math.cos(2 * math.pi * i / n - math.pi / 2), cy + r * math.sin(2 * math.pi * i / n - math.pi / 2))
        for i, v in enumerate(nodes)
    }


def _random_connected(rng: random.Random, n: int, p: float) -> nx.Graph:
    nodes = list(range(1, n + 1))
    g = nx.Graph()
    g.add_nodes_from(nodes)
    order = nodes[:]
    rng.shuffle(order)
    for i in range(1, n):  # random spanning tree first -> connected
        g.add_edge(order[i], order[rng.randrange(i)])
    for u, v in itertools.combinations(nodes, 2):
        if not g.has_edge(u, v) and rng.random() < p:
            g.add_edge(u, v)
    return g


def _parse_number(x: Any) -> float | None:
    if x is None:
        return None
    if isinstance(x, (int, float)):
        return float(x)
    s = str(x).strip().lower().replace(",", ".")
    if s in {"inf", "∞", "oo", "nekonecno", "nekonečno", "-", "x"}:
        return INF
    try:
        return float(s)
    except ValueError:
        return None


def _fmt(x: float) -> str:
    if x == INF:
        return r"\infty"
    return str(int(x)) if float(x).is_integer() else str(x)


def _matrix_tex(m: list[list[float]]) -> str:
    rows = [" & ".join(_fmt(v) for v in row) for row in m]
    return r"\begin{bmatrix}" + r" \\ ".join(rows) + r"\end{bmatrix}"


def _check_integer(task: Task, answer: Any) -> tuple[bool, float]:
    val = _parse_number(answer.get("value") if isinstance(answer, dict) else answer)
    ok = val is not None and val == task.solution
    return ok, 1.0 if ok else 0.0


def _check_vector(task: Task, answer: Any) -> tuple[bool, float]:
    values = answer.get("values") if isinstance(answer, dict) else answer
    if not isinstance(values, list) or len(values) != len(task.solution):
        return False, 0.0
    hits = sum(1 for a, b in zip(values, task.solution) if _parse_number(a) == b)
    return hits == len(task.solution), hits / len(task.solution)


def _check_matrix(task: Task, answer: Any) -> tuple[bool, float]:
    rows = answer.get("matrix") if isinstance(answer, dict) else answer
    sol = task.solution
    if not isinstance(rows, list) or len(rows) != len(sol) or any(
        not isinstance(r, list) or len(r) != len(sol) for r in rows
    ):
        return False, 0.0
    total = len(sol) ** 2
    hits = sum(1 for i, r in enumerate(rows) for j, v in enumerate(r) if _parse_number(v) == sol[i][j])
    return hits == total, hits / total


# --------------------------------------------------------------- max flow


def build_max_flow(rng: random.Random, difficulty: int) -> Task:
    layers = [["z"], ["a", "b"], ["c", "d"], ["s"]] if difficulty <= 1 else [["z"], ["a", "b", "c"], ["d", "e", "f"], ["s"]]
    g = nx.DiGraph()
    pos = {}
    for li, layer in enumerate(layers):
        for ni, v in enumerate(layer):
            g.add_node(v)
            pos[v] = (1 + li * 8 / (len(layers) - 1), 5 + (ni - (len(layer) - 1) / 2) * 3.2)
    cap = lambda: rng.randint(1, 9)  # noqa: E731
    for v in layers[1]:
        g.add_edge("z", v, w=cap())
    for v in layers[2]:
        g.add_edge(v, "s", w=cap())
    for u in layers[1]:
        targets = [v for v in layers[2] if rng.random() < 0.6] or [rng.choice(layers[2])]
        for v in targets:
            g.add_edge(u, v, w=cap())
    # a few edges inside layers make residual semi-paths interesting
    for layer in (layers[1], layers[2]):
        for u, v in itertools.permutations(layer, 2):
            if not g.has_edge(v, u) and rng.random() < 0.25:
                g.add_edge(u, v, w=cap())
    value, (R, Rbar) = nx.minimum_cut(g, "z", "s", capacity="w")
    flow_value, flow = nx.maximum_flow(g, "z", "s", capacity="w")
    cut_edges = sorted((u, v) for u, v in g.edges if u in R and v in Rbar)
    edges_txt = ", ".join(f"$({u},{v})$" for u, v in cut_edges)
    flow_txt = ", ".join(f"$x_{{{u}{v}}}={flow[u][v]}$" for u, v in g.edges if flow[u][v])
    return Task(
        prompt="Určete **velikost maximálního toku** ze zdroje $z$ do stoku $s$ v síti na obrázku "
        "(čísla u hran jsou propustnosti $r_{ij}$).",
        answer_spec={"kind": "integer", "label": "|x| ="},
        data=_graph_json(g, pos, directed=True),
        solution=float(value),
        explanation=(
            f"Velikost maximálního toku je **{int(value)}**.\n\n"
            f"Jeden maximální tok: {flow_txt}.\n\n"
            f"Minimální řez $(R, \\bar R)$ s $R = \\{{{', '.join(sorted(R))}\\}}$ obsahuje hrany {edges_txt} "
            f"a má propustnost {int(value)} – podle Ford–Fulkersonovy věty tedy tok nemůže být větší."
        ),
    )


# ------------------------------------------------------------------ floyd


def build_floyd(rng: random.Random, difficulty: int) -> Task:
    n = 4 if difficulty <= 1 else 5
    nodes = list(range(1, n + 1))
    g = nx.DiGraph()
    g.add_nodes_from(nodes)
    for u, v in itertools.permutations(nodes, 2):
        if rng.random() < 0.4:
            g.add_edge(u, v, w=rng.randint(1, 9))
    if g.number_of_edges() < n:
        for i in range(n):
            u, v = nodes[i], nodes[(i + 1) % n]
            if not g.has_edge(u, v):
                g.add_edge(u, v, w=rng.randint(1, 9))
    dist = dict(nx.floyd_warshall(g, weight="w"))
    sol = [[float(dist[i][j]) for j in nodes] for i in nodes]
    d0 = [[0.0 if i == j else float(g[i][j]["w"]) if g.has_edge(i, j) else INF for j in nodes] for i in nodes]
    return Task(
        prompt=f"Pomocí Floydova algoritmu určete **w-distanční matici** $\\mathbf{{D}}^w(\\vec G)$ orientovaného grafu na obrázku "
        f"(uzly $1,\\dots,{n}$). Nedosažitelné dvojice zapište jako `inf` (∞).",
        answer_spec={"kind": "matrix", "size": n, "labels": [str(v) for v in nodes], "allow_inf": True},
        data=_graph_json(g, _circle_pos(nodes), directed=True),
        solution=sol,
        explanation=f"Počáteční matice $$\\mathbf{{D}}_0 = {_matrix_tex(d0)}$$ a výsledná matice "
        f"$$\\mathbf{{D}}_{n} = \\mathbf{{D}}^w(\\vec G) = {_matrix_tex(sol)}.$$",
    )


# -------------------------------------------------------------------- mst


def build_mst(rng: random.Random, difficulty: int) -> Task:
    n = 6 if difficulty <= 1 else 8
    g = _random_connected(rng, n, 0.35 if difficulty <= 1 else 0.3)
    for u, v in g.edges:
        g[u][v]["w"] = rng.randint(1, 12)
    t = nx.minimum_spanning_tree(g, weight="w", algorithm="kruskal")
    total = sum(d["w"] for _, _, d in t.edges(data=True))
    edges = ", ".join(f"$\\{{{u},{v}\\}}$ ({d['w']})" for u, v, d in sorted(t.edges(data=True), key=lambda e: e[2]["w"]))
    return Task(
        prompt="Určete **součet ohodnocení minimální kostry** grafu na obrázku.",
        answer_spec={"kind": "integer", "label": "w(T) ="},
        data=_graph_json(g, _circle_pos(list(g.nodes))),
        solution=float(total),
        explanation=f"Minimální kostra má váhu **{total}**. Např. Kruskalův algoritmus vybere hrany {edges}.",
    )


# --------------------------------------------------------------- dijkstra


def build_dijkstra(rng: random.Random, difficulty: int) -> Task:
    n = 6 if difficulty <= 1 else 8
    g = _random_connected(rng, n, 0.3)
    for u, v in g.edges:
        g[u][v]["w"] = rng.randint(1, 9)
    nodes = sorted(g.nodes)
    dist = nx.single_source_dijkstra_path_length(g, 1, weight="w")
    paths = nx.single_source_dijkstra_path(g, 1, weight="w")
    sol = [float(dist.get(v, INF)) for v in nodes]
    lines = "\n".join(f"- $d^w(1,{v}) = {_fmt(dist[v])}$ – cesta {' → '.join(map(str, paths[v]))}" for v in nodes)
    return Task(
        prompt="Určete **w-vzdálenosti** z uzlu $1$ do všech uzlů neorientovaného ohodnoceného grafu (např. Dijkstrovým algoritmem).",
        answer_spec={"kind": "vector", "labels": [f"d(1,{v})" for v in nodes], "allow_inf": True},
        data=_graph_json(g, _circle_pos(nodes)),
        solution=sol,
        explanation=f"Vzdálenosti a minimální cesty:\n\n{lines}",
    )


# ---------------------------------------------------------- critical path


def build_critical_path(rng: random.Random, difficulty: int) -> Task:
    n = 6 if difficulty <= 1 else 8
    nodes = list(range(1, n + 1))
    g = nx.DiGraph()
    g.add_nodes_from(nodes)
    for i in range(1, n):  # path through all nodes in a random-ish way keeps 1 -> n reachable
        j = rng.randint(i + 1, min(n, i + 2))
        g.add_edge(i, j, w=rng.randint(1, 9))
    for u, v in itertools.combinations(nodes, 2):
        if not g.has_edge(u, v) and rng.random() < 0.3:
            g.add_edge(u, v, w=rng.randint(1, 9))
    # longest path 1 -> n via DP over topological order
    best = {v: -INF for v in nodes}
    prev: dict[int, int | None] = {1: None}
    best[1] = 0
    for v in nx.topological_sort(g):
        if best[v] == -INF:
            continue
        for _, w_, d in g.out_edges(v, data=True):
            if best[v] + d["w"] > best[w_]:
                best[w_] = best[v] + d["w"]
                prev[w_] = v
    path, cur = [], n
    while cur is not None:
        path.append(cur)
        cur = prev.get(cur)
    path.reverse()
    # shuffle labels so the topological order is not just 1..n (except source/sink)
    pos = {}
    levels: dict[int, int] = {}
    for v in nx.topological_sort(g):
        levels[v] = max([levels[u] + 1 for u in g.predecessors(v)] or [0])
    by_level: dict[int, list[int]] = {}
    for v, lv in levels.items():
        by_level.setdefault(lv, []).append(v)
    maxlv = max(by_level)
    for lv, vs in by_level.items():
        for k, v in enumerate(vs):
            pos[v] = (1 + 8 * lv / max(1, maxlv), 5 + (k - (len(vs) - 1) / 2) * 3)
    return Task(
        prompt=f"V acyklickém ohodnoceném grafu najděte **délku kritické cesty** (nejdelší orientované cesty) z uzlu $1$ do uzlu ${n}$.",
        answer_spec={"kind": "integer", "label": "délka ="},
        data=_graph_json(g, pos, directed=True),
        solution=float(best[n]),
        explanation=f"Kritická cesta je {' → '.join(map(str, path))} s délkou **{int(best[n])}** "
        "(výpočet podle topologického uspořádání: pro každý uzel maximum přes předchůdce).",
    )


# ----------------------------------------------------- matrix reducibility


def build_reducibility(rng: random.Random, difficulty: int) -> Task:
    n = 5 if difficulty <= 1 else 6
    while True:
        m = [[0] * n for _ in range(n)]
        for i in range(n):
            for j in range(n):
                if i == j:
                    m[i][j] = rng.choice([0, rng.randint(1, 9)])
                elif rng.random() < 0.3:
                    m[i][j] = rng.randint(1, 9)
        g = nx.DiGraph()
        g.add_nodes_from(range(1, n + 1))
        g.add_edges_from((i + 1, j + 1) for i in range(n) for j in range(n) if i != j and m[i][j])
        comps = list(nx.strongly_connected_components(g))
        if 1 <= len(comps) <= n - 1 or rng.random() < 0.3:
            break
    k = len(comps)
    comps_txt = ", ".join("\\{" + ", ".join(map(str, sorted(c))) + "\\}" for c in sorted(comps, key=min))
    return Task(
        prompt=f"Je čtvercová matice $$\\mathbf{{A}} = {_matrix_tex([[float(v) for v in r] for r in m])}$$ **rozložitelná**? "
        "Určete také **počet kvazikomponent** jejího diagramu $\\vec G(\\mathbf{A})$.",
        answer_spec={"kind": "reducibility"},
        data={"matrix": m},
        solution={"reducible": k > 1, "components": k},
        explanation=f"Diagram matice má {k} kvazikomponent: ${comps_txt}$. "
        + (
            "Protože není silně souvislý, je matice **rozložitelná** (důsledek 3.1)."
            if k > 1
            else "Diagram je silně souvislý, matice je tedy **nerozložitelná** (důsledek 3.1)."
        ),
    )


def _check_reducibility(task: Task, answer: Any) -> tuple[bool, float]:
    if not isinstance(answer, dict):
        return False, 0.0
    a = isinstance(answer.get("reducible"), bool) and answer["reducible"] == task.solution["reducible"]
    b = _parse_number(answer.get("components")) == task.solution["components"]
    return a and b, (a + b) / 2


# ------------------------------------------------------------------- 2-SAT


def build_two_sat(rng: random.Random, difficulty: int) -> Task:
    nvars = 3 if difficulty <= 1 else 4
    m = rng.randint(nvars + 1, nvars + 3)
    variables = [f"x{i}" for i in range(1, nvars + 1)]
    clauses = []
    for _ in range(m):
        a, b = rng.sample(range(nvars), 2)
        clauses.append(((a, rng.random() < 0.5), (b, rng.random() < 0.5)))  # (var, negated)

    def lit_tex(lit):
        var, neg = lit
        return f"\\overline{{x_{var + 1}}}" if neg else f"x_{var + 1}"

    formula = " \\wedge ".join(f"({lit_tex(a)} \\vee {lit_tex(b)})" for a, b in clauses)
    sat_assignment = None
    for bits in itertools.product([False, True], repeat=nvars):
        if all(any(bits[v] != neg for v, neg in cl) for cl in clauses):
            sat_assignment = bits
            break
    # implication graph for the explanation / visualization
    ig = nx.DiGraph()
    names = lambda v, neg: f"¬x{v + 1}" if neg else f"x{v + 1}"  # noqa: E731
    for v in range(nvars):
        ig.add_node(names(v, False))
        ig.add_node(names(v, True))
    for (a, na), (b, nb) in clauses:
        ig.add_edge(names(a, not na), names(b, nb))
        ig.add_edge(names(b, not nb), names(a, na))
    sccs = [sorted(c) for c in nx.strongly_connected_components(ig) if len(c) > 1]
    ig_nodes = [names(v, neg) for neg in (False, True) for v in range(nvars)]
    pos = {}
    for i, v in enumerate(range(nvars)):
        pos[names(v, False)] = (1 + i * 8 / max(1, nvars - 1), 2)
        pos[names(v, True)] = (1 + i * 8 / max(1, nvars - 1), 8)
    if sat_assignment is not None:
        assign = ", ".join(f"$x_{i + 1}={int(b)}$" for i, b in enumerate(sat_assignment))
        expl = f"Formule je **splnitelná**, např. {assign}. Žádná kvazikomponenta implikačního grafu neobsahuje současně $x_i$ a $\\overline{{x_i}}$."
    else:
        bad = next(c for c in sccs if any(f"¬{x}" in c and x in c for x in variables))
        expl = (
            "Formule **není splnitelná**: kvazikomponenta implikačního grafu "
            f"$\\{{{', '.join(bad)}\\}}$ obsahuje proměnnou i její negaci (lemma 9.4)."
        )
    return Task(
        prompt=f"Rozhodněte, zda je formule $$f = {formula}$$ **splnitelná**. Pokud ano, zadejte splňující přiřazení.",
        answer_spec={"kind": "sat", "variables": variables},
        data={"formula": formula, **_graph_json(ig, pos, weight=None, directed=True)},
        solution={"clauses": clauses, "satisfiable": sat_assignment is not None, "nvars": nvars},
        explanation=expl + "\n\nImplikační graf: každá klauzule $(a \\vee b)$ dává hrany $\\bar a \\to b$ a $\\bar b \\to a$.",
    )


def _check_two_sat(task: Task, answer: Any) -> tuple[bool, float]:
    if not isinstance(answer, dict):
        return False, 0.0
    sol = task.solution
    if not isinstance(answer.get("satisfiable"), bool) or answer["satisfiable"] != sol["satisfiable"]:
        return False, 0.0
    if not sol["satisfiable"]:
        return True, 1.0
    assignment = answer.get("assignment") or {}
    bits = [bool(assignment.get(f"x{i + 1}")) for i in range(sol["nvars"])]
    ok = all(any(bits[v] != neg for v, neg in cl) for cl in sol["clauses"])
    return ok, 1.0 if ok else 0.5


# -------------------------------------------------- coloring / independence


def _chromatic_number(g: nx.Graph) -> tuple[int, dict]:
    nodes = sorted(g.nodes, key=lambda v: -g.degree(v))
    for k in range(1, len(nodes) + 1):
        colors: dict = {}

        def bt(i: int) -> bool:
            if i == len(nodes):
                return True
            v = nodes[i]
            used = {colors[u] for u in g[v] if u in colors}
            for c in range(min(k, i + 1)):  # symmetry breaking
                if c not in used:
                    colors[v] = c
                    if bt(i + 1):
                        return True
                    del colors[v]
            return False

        if bt(0):
            return k, dict(colors)
    raise AssertionError("unreachable")


def build_chromatic(rng: random.Random, difficulty: int) -> Task:
    n = 6 if difficulty <= 1 else 8
    g = _random_connected(rng, n, 0.45)
    k, coloring = _chromatic_number(g)
    data = _graph_json(g, _circle_pos(sorted(g.nodes)), weight=None)
    classes = {}
    for v, c in coloring.items():
        classes.setdefault(c, []).append(v)
    cls = "; ".join("\\{" + ", ".join(map(str, sorted(vs))) + "\\}" for vs in classes.values())
    clique = max(nx.find_cliques(g), key=len)
    return Task(
        prompt="Určete **chromatické číslo** $\\chi(G)$ grafu na obrázku.",
        answer_spec={"kind": "integer", "label": "χ(G) ="},
        data=data,
        solution=float(k),
        explanation=f"$\\chi(G) = {k}$. Obarvení s {k} barvami (barevné třídy): ${cls}$. "
        f"Dolní odhad dává např. klika $\\{{{', '.join(map(str, sorted(clique)))}\\}}$ velikosti {len(clique)}"
        + ("" if len(clique) == k else " – zde ale klikovost nestačí a je třeba ukázat, že méně barev nejde (např. lichá kružnice).")
        + ".",
    )


def build_independence(rng: random.Random, difficulty: int) -> Task:
    n = 7 if difficulty <= 1 else 9
    g = _random_connected(rng, n, 0.35)
    comp = nx.complement(g)
    best = max(nx.find_cliques(comp), key=len)
    return Task(
        prompt="Určete **nezávislost** $\\alpha(G)$ grafu na obrázku (největší počet uzlů nezávislé množiny).",
        answer_spec={"kind": "integer", "label": "α(G) ="},
        data=_graph_json(g, _circle_pos(sorted(g.nodes)), weight=None),
        solution=float(len(best)),
        explanation=f"$\\alpha(G) = {len(best)}$, např. nezávislá množina $\\{{{', '.join(map(str, sorted(best)))}\\}}$. "
        f"Její doplněk je minimální pokrytí, takže $\\beta(G) = {n - len(best)}$ (věta 6.1: $\\alpha + \\beta = n$).",
    )


# ---------------------------------------------------------------- registry

EXERCISES: dict[str, Exercise] = {
    e.id: e
    for e in [
        Exercise("mst", "Minimální kostra", "zaklady", "Součet vah minimální kostry.", build_mst, _check_integer),
        Exercise("dijkstra", "Vzdálenosti z uzlu", "metrika-orientovane", "w-vzdálenosti z uzlu 1 (Dijkstra).", build_dijkstra, _check_vector),
        Exercise("critical-path", "Kritická cesta", "metrika-orientovane", "Délka nejdelší cesty v acyklickém grafu.", build_critical_path, _check_integer),
        Exercise("max-flow", "Maximální tok", "toky", "Velikost maximálního toku v síti.", build_max_flow, _check_integer),
        Exercise("floyd", "Floydův algoritmus", "grafy-matice", "Kompletní w-distanční matice.", build_floyd, _check_matrix),
        Exercise("reducibility", "Rozložitelnost matice", "grafy-matice", "Rozložitelnost a počet kvazikomponent diagramu.", build_reducibility, _check_reducibility),
        Exercise("independence", "Nezávislost grafu", "nezavislost-jadro", "Určení α(G).", build_independence, _check_integer),
        Exercise("chromatic", "Chromatické číslo", "barevnost", "Určení χ(G).", build_chromatic, _check_integer),
        Exercise("two-sat", "2-SAT", "np-uplnost", "Splnitelnost 2-CNF formule.", build_two_sat, _check_two_sat),
    ]
}


def new_seed() -> str:
    return "".join(random.SystemRandom().choices(string.ascii_lowercase + string.digits, k=10))


def build(exercise_id: str, seed: str, difficulty: int) -> Task:
    ex = EXERCISES[exercise_id]
    rng = random.Random(f"{exercise_id}:{seed}:{difficulty}")
    return ex.build(rng, difficulty)
