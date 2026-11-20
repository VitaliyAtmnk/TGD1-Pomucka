import pytest

from app.exercises.registry import EXERCISES, build


@pytest.mark.parametrize("ex_id", list(EXERCISES))
@pytest.mark.parametrize("difficulty", [1, 2])
def test_generation_is_deterministic_and_solution_checks(ex_id, difficulty):
    for seed in ["a", "b", "c", "d", "e"]:
        t1, t2 = build(ex_id, seed, difficulty), build(ex_id, seed, difficulty)
        assert t1.prompt == t2.prompt and t1.data == t2.data
        ex = EXERCISES[ex_id]
        spec = t1.answer_spec["kind"]
        sol = t1.solution
        if spec == "integer":
            answer = {"value": str(int(sol))}
        elif spec == "vector":
            answer = {"values": ["inf" if v == float("inf") else str(int(v)) for v in sol]}
        elif spec == "matrix":
            answer = {"matrix": [["inf" if v == float("inf") else str(int(v)) for v in row] for row in sol]}
        elif spec == "reducibility":
            answer = sol
        elif spec == "sat":
            answer = {"satisfiable": sol["satisfiable"], "assignment": {}}
            if sol["satisfiable"]:
                import itertools
                for bits in itertools.product([False, True], repeat=sol["nvars"]):
                    if all(any(bits[v] != neg for v, neg in cl) for cl in sol["clauses"]):
                        answer["assignment"] = {f"x{i+1}": b for i, b in enumerate(bits)}
                        break
        else:
            pytest.fail(spec)
        assert ex.check(t1, answer) == (True, 1.0)
        assert ex.check(t1, {"value": "-12345"})[0] is False


def test_api_generate_and_check(client):
    t = client.post("/api/exercises/generate", json={"type": "max-flow", "seed": "x"}).json()
    assert t["answer_spec"]["kind"] == "integer" and t["data"]["graph"]["directed"]
    r = client.post("/api/exercises/check", json={"type": "max-flow", "seed": "x", "answer": {"value": "0"}}).json()
    assert r["correct"] is False and "Minimální řez" in r["explanation"]
