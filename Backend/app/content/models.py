"""Pydantic schema of the study content (see content/SCHEMA.md)."""

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

ItemKind = Literal["definition", "theorem", "proposition", "lemma", "corollary", "algorithm", "remark"]
PROVABLE_KINDS = {"theorem", "proposition", "lemma", "corollary"}

VISUALIZATIONS: dict[str, str] = {
    "graph-search": "Prohledávání do šířky / hloubky",
    "dijkstra": "Dijkstrův algoritmus",
    "mst": "Minimální kostra",
    "floyd": "Floydův algoritmus",
    "critical-path": "Kritická cesta",
    "scc": "Kvazikomponenty a kondenzace",
    "max-flow": "Maximální tok",
    "matrix-reducibility": "Rozložitelnost matice",
    "bipartite-matching": "Párování v bigrafu",
    "blocks": "Mosty, artikulace, bloky",
    "euler": "Eulerovský tah",
    "hamilton-backtracking": "Backtracking – hamiltonovská kružnice",
    "bondy-chvatal": "Uzávěr grafu",
    "independent-set": "Nezávislé množiny",
    "kernel": "Jádro orientovaného grafu",
    "coloring": "Barvení grafu",
    "two-sat": "2-SAT",
    "reduction-3sat-ind": "Redukce 3-SAT → IND",
    "reduction-3sat-3col": "Redukce 3-SAT → 3-COL",
    "vertex-cover-fpt": "FPT vrcholové pokrytí",
}


class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid")


class GraphNode(BaseModel):
    model_config = ConfigDict(extra="allow")
    id: str | int
    x: float | None = None
    y: float | None = None


class GraphEdge(BaseModel):
    model_config = ConfigDict(extra="allow", populate_by_name=True)
    source: str | int = Field(alias="from")
    target: str | int = Field(alias="to")
    w: float | str | None = None  # number, or a text label such as "∞"


class GraphData(BaseModel):
    model_config = ConfigDict(extra="allow")
    directed: bool = False
    nodes: list[GraphNode]
    edges: list[GraphEdge] = []


class Example(Strict):
    title: str | None = None
    body: str
    graph: GraphData | None = None


# Graph properties the frontend can check live (FrontEnd/src/viz/properties.ts).
PROPERTIES: set[str] = {
    "acyclic", "connected", "strongly-connected", "tree", "bipartite", "eulerian", "hamiltonian", "complete",
    "independent-set", "vertex-cover", "clique", "dominating-set", "kernel", "separating-set",
    "disconnecting-edges", "spanning-tree", "matching", "proper-coloring",
}
NODE_STATES = {"default", "active", "frontier", "visited", "done", "source", "sink", "rejected", "path"}
EDGE_STATES = {"default", "active", "considered", "tree", "rejected", "path", "cut", "back", "dim", "hidden"}


class IllustrationStep(Strict):
    caption: str
    add: list[list[str | int | float]] = []  # edges [from, to] or [from, to, w] added (cumulative)
    remove: list[list[str | int]] = []  # edges [from, to] removed (cumulative)
    nodes: dict[str, str] = {}  # node id -> state (this step only)
    edges: dict[str, str] = {}  # "from-to" -> edge state (this step only)
    labels: dict[str, str] = {}  # node id -> small label (this step only)
    edge_labels: dict[str, str] = {}  # "from-to" -> edge label, e.g. flow "2/3" (this step only)
    set: list[str | int] = []  # selected nodes (for node-set properties)
    edge_set: list[str] = []  # selected edges "from-to" (for edge-set properties)
    colors: dict[str, int] = {}  # node id -> colour class (for proper-coloring)
    witness: bool | None = None  # draw the property witness (default: when no explicit highlight)


class Illustration(Strict):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)
    title: str
    target: Literal["statement", "proof"] = Field(default="statement", alias="for")
    property: str | None = None
    graph: GraphData
    steps: list[IllustrationStep] = Field(min_length=1)
    interactive: bool | None = None

    @model_validator(mode="after")
    def _check(self) -> "Illustration":
        if self.property and self.property not in PROPERTIES:
            raise ValueError(f"illustration '{self.title}': unknown property '{self.property}'")
        node_ids = {str(n.id) for n in self.graph.nodes}
        directed = self.graph.directed
        edges = [(str(e.source), str(e.target)) for e in self.graph.edges]

        def key_ok(k: str) -> bool:
            if "-" not in k:
                return False
            a, b = k.split("-", 1)
            return (a, b) in edges or (not directed and (b, a) in edges)

        for i, st in enumerate(self.steps, 1):
            where = f"illustration '{self.title}', step {i}"
            for e in st.add:
                a, b = str(e[0]), str(e[1])
                if a not in node_ids or b not in node_ids:
                    raise ValueError(f"{where}: add edge {a}-{b} uses unknown node")
                edges.append((a, b))
            for e in st.remove:
                a, b = str(e[0]), str(e[1])
                if (a, b) in edges:
                    edges.remove((a, b))
                elif not directed and (b, a) in edges:
                    edges.remove((b, a))
                else:
                    raise ValueError(f"{where}: remove edge {a}-{b} that does not exist")
            for v, s in st.nodes.items():
                if v not in node_ids or s not in NODE_STATES:
                    raise ValueError(f"{where}: bad node highlight {v}: {s}")
            for k, s in st.edges.items():
                if not key_ok(k) or s not in EDGE_STATES:
                    raise ValueError(f"{where}: bad edge highlight {k}: {s} (edge must exist in this step)")
            for k in st.edge_labels:
                if not key_ok(k):
                    raise ValueError(f"{where}: edge_labels entry '{k}' is not an edge in this step")
            for v in [*st.labels, *map(str, st.set), *st.colors]:
                if v not in node_ids:
                    raise ValueError(f"{where}: unknown node '{v}'")
            for k in st.edge_set:
                if not key_ok(k):
                    raise ValueError(f"{where}: edge_set entry '{k}' is not an edge in this step")
        return self


class Item(Strict):
    id: str
    kind: ItemKind
    label: str | None = None
    section: str | None = None
    title: str
    terms: list[str] = []
    statement: str
    intuition: str | None = None
    proof: str | None = None
    proof_steps: list[str] = []
    pseudocode: str | None = None
    complexity: str | None = None
    examples: list[Example] = []
    illustrations: list[Illustration] = []
    visualization: str | None = None
    related: list[str] = []
    source: str | None = None
    supplemented: bool = False


class QuizQuestion(Strict):
    id: str
    question: str
    options: list[str] = Field(min_length=2)
    correct: int
    explanation: str | None = None
    related: list[str] = []

    @model_validator(mode="after")
    def _check_correct(self) -> "QuizQuestion":
        if not 0 <= self.correct < len(self.options):
            raise ValueError(f"quiz {self.id}: correct index {self.correct} out of range")
        return self


class Section(Strict):
    number: str
    title: str


class Chapter(Strict):
    id: str
    number: int
    title: str
    source: str | None = None
    exam_questions: list[int] = []
    summary: str | None = None
    sections: list[Section] = []
    items: list[Item] = []
    quiz: list[QuizQuestion] = []


class ExamQuestion(Strict):
    number: int
    title: str
    group: int
    chapters: list[str] = []
    items: list[str] = []
    outline: str | None = None
    algorithms: str | None = None
    example_tasks: str | None = None


class ExamFile(Strict):
    questions: list[ExamQuestion] = []


def dump(model: BaseModel) -> dict[str, Any]:
    """Serialize with the YAML field names (`from`/`to` for edges)."""
    return model.model_dump(by_alias=True, exclude_none=True)
