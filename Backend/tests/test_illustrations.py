import pytest
from pydantic import ValidationError

from app.content.models import Illustration

GRAPH = {
    "directed": True,
    "nodes": [{"id": "a"}, {"id": "b"}, {"id": "c"}],
    "edges": [{"from": "a", "to": "b"}, {"from": "b", "to": "c"}],
}


def make(steps, **kw):
    return Illustration.model_validate({"title": "T", "graph": GRAPH, "steps": steps, **kw})


def test_valid_illustration_with_cumulative_edges():
    ill = make(
        [
            {"caption": "start"},
            {"caption": "add", "add": [["c", "a"]], "edges": {"c-a": "path"}},
            {"caption": "still there", "edges": {"c-a": "active"}, "edge_labels": {"a-b": "1/2"}},
            {"caption": "remove", "remove": [["c", "a"]]},
        ],
        property="acyclic",
        **{"for": "proof"},
    )
    assert ill.target == "proof"


@pytest.mark.parametrize(
    "steps,kw",
    [
        ([{"caption": "x", "edges": {"c-a": "path"}}], {}),  # edge does not exist yet
        ([{"caption": "x", "add": [["a", "z"]]}], {}),  # unknown node
        ([{"caption": "x", "remove": [["a", "c"]]}], {}),  # removing a missing edge
        ([{"caption": "x", "nodes": {"a": "shiny"}}], {}),  # unknown state
        ([{"caption": "x"}], {"property": "planar"}),  # unknown property
        ([{"caption": "x", "add": [["c", "a"]]}, {"caption": "y", "remove": [["c", "a"]], "edges": {"c-a": "path"}}], {}),
    ],
)
def test_invalid_illustrations_are_rejected(steps, kw):
    with pytest.raises(ValidationError):
        make(steps, **kw)
