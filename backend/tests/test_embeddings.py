"""Optional semantic-retrieval layer (v1.10) — see app/services/knowledge.py.

Everything here is gated on OPENROUTER_API_KEY; with it blank (the default for
every other test in this repo) available() is False and nothing below runs.
These tests set a dummy key via monkeypatch and mock the raw HTTP call
(``_post_embeddings``) so no real network / provider is ever involved.
"""

import pytest

from app.core.config import settings
from app.services import embeddings


@pytest.fixture(autouse=True)
def _clear_embedding_caches():
    """The corpus/query caches are module-level dicts that would otherwise
    leak between tests in the same process."""
    embeddings._CORPUS_CACHE.clear()
    embeddings._QUERY_CACHE.clear()
    yield
    embeddings._CORPUS_CACHE.clear()
    embeddings._QUERY_CACHE.clear()


def test_unavailable_without_a_key(monkeypatch):
    monkeypatch.setattr(settings, "openrouter_api_key", "")
    assert embeddings.available() is False
    assert embeddings.embed_query("anything") is None
    assert embeddings.corpus_vectors(["a"], ["some text"]) is None


def test_available_with_a_key(monkeypatch):
    monkeypatch.setattr(settings, "openrouter_api_key", "dummy-key")
    assert embeddings.available() is True


def test_corpus_vectors_embeds_once_then_caches(monkeypatch):
    monkeypatch.setattr(settings, "openrouter_api_key", "dummy-key")
    calls: list[list[str]] = []

    def fake_post(inputs: list[str]):
        calls.append(list(inputs))
        return [[1.0, 0.0] for _ in inputs]

    monkeypatch.setattr(embeddings, "_post_embeddings", fake_post)

    first = embeddings.corpus_vectors(["a", "b"], ["text a", "text b"])
    assert first == {"a": [1.0, 0.0], "b": [1.0, 0.0]}
    assert len(calls) == 1 and calls[0] == ["text a", "text b"]

    # a repeat call for the same ids must not re-embed anything
    second = embeddings.corpus_vectors(["a", "b"], ["text a", "text b"])
    assert second == first
    assert len(calls) == 1

    # a new id gets embedded; the already-cached ones aren't re-sent
    third = embeddings.corpus_vectors(["a", "b", "c"], ["text a", "text b", "text c"])
    assert third == {"a": [1.0, 0.0], "b": [1.0, 0.0], "c": [1.0, 0.0]}
    assert len(calls) == 2 and calls[1] == ["text c"]


def test_corpus_vectors_none_when_nothing_cached_and_call_fails(monkeypatch):
    monkeypatch.setattr(settings, "openrouter_api_key", "dummy-key")
    monkeypatch.setattr(embeddings, "_post_embeddings", lambda inputs: None)
    assert embeddings.corpus_vectors(["a"], ["text a"]) is None


def test_embed_query_caches_case_insensitively(monkeypatch):
    monkeypatch.setattr(settings, "openrouter_api_key", "dummy-key")
    calls: list[list[str]] = []
    monkeypatch.setattr(
        embeddings, "_post_embeddings",
        lambda inputs: (calls.append(list(inputs)), [[0.1, 0.2]])[1],
    )
    v1 = embeddings.embed_query("how does msp work")
    v2 = embeddings.embed_query("HOW DOES MSP WORK")  # same query, different case
    assert v1 == v2 == [0.1, 0.2]
    assert len(calls) == 1


def test_embed_query_none_when_provider_fails(monkeypatch):
    monkeypatch.setattr(settings, "openrouter_api_key", "dummy-key")
    monkeypatch.setattr(embeddings, "_post_embeddings", lambda inputs: None)
    assert embeddings.embed_query("anything") is None


def test_cosine_similarity():
    assert embeddings.cosine([1.0, 0.0], [1.0, 0.0]) == pytest.approx(1.0)
    assert embeddings.cosine([1.0, 0.0], [0.0, 1.0]) == pytest.approx(0.0)
    assert embeddings.cosine([], [1.0]) == 0.0
    assert embeddings.cosine([0.0, 0.0], [1.0, 1.0]) == 0.0
