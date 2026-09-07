"""Optional semantic re-ranking for Ask AgriLink retrieval (v1.10).

``knowledge.py``'s TF-IDF + fuzzy + curated-synonym retrieval is deliberately
offline-safe and needs nothing here to work — every retrieval test in this
repo runs with no key configured and gets the same keyword-based result it
always has. This module adds an *optional* layer on top of that: when
``OPENROUTER_API_KEY`` is set and the configured model actually supports an
embeddings call, cosine similarity between the query and each corpus chunk is
folded into the retrieval score, so a paraphrase sharing no vocabulary with
the corpus (and not covered by ``knowledge._SYNONYMS``) can still surface the
right chunk.

Rides on the same OpenRouter key as the rest of the LLM layer rather than
requiring a second one — but it is genuinely optional, and a failure (no key,
unreachable, or a model that doesn't serve embeddings) must never break a
search: every function here returns ``None`` rather than raising, and
``knowledge.search`` treats that exactly like the feature being absent.
"""

import logging
import time

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

# Corpus chunk embeddings computed once per process (the corpus itself is
# already process-cached via knowledge._corpus()'s lru_cache) so repeat
# searches don't re-embed the same ~20 chunks every call.
_CORPUS_CACHE: dict[str, list[float]] = {}

# Short-lived cache for query embeddings — a user session tends to repeat or
# lightly edit the same question.
_QUERY_CACHE: dict[str, tuple[float, list[float]]] = {}
_QUERY_TTL_SECONDS = 3600


def available() -> bool:
    return bool(settings.openrouter_api_key)


def _post_embeddings(inputs: list[str]) -> list[list[float]] | None:
    """Raw embeddings call for a batch of texts. None on any failure."""
    if not inputs or not settings.openrouter_api_key:
        return None
    try:
        with httpx.Client(timeout=15.0) as client:
            resp = client.post(
                settings.embedding_url,
                headers={
                    "Authorization": f"Bearer {settings.openrouter_api_key}",
                    "Content-Type": "application/json",
                },
                json={"model": settings.embedding_model, "input": inputs},
            )
            resp.raise_for_status()
            data = resp.json()
        rows = data["data"]
        return [row["embedding"] for row in rows]
    except Exception as exc:  # noqa: BLE001 - a broken embeddings provider must not break search
        logger.warning("Embedding request failed (%s)", exc)
        return None


def embed_query(text: str) -> list[float] | None:
    """Embedding for one query string, cached for `_QUERY_TTL_SECONDS`."""
    key = (text or "").strip().lower()
    if not key:
        return None
    hit = _QUERY_CACHE.get(key)
    if hit and time.time() - hit[0] < _QUERY_TTL_SECONDS:
        return hit[1]
    out = _post_embeddings([text])
    if out is None:
        return None
    vec = out[0]
    _QUERY_CACHE[key] = (time.time(), vec)
    return vec


def corpus_vectors(doc_ids: list[str], doc_texts: list[str]) -> dict[str, list[float]] | None:
    """Embeddings for the given corpus docs, keyed by id.

    Embeds only the ids not already cached this process. Returns None only
    when nothing is cached yet *and* the embedding call fails — otherwise
    returns whatever subset is available (a partial result still lets search
    apply the semantic bonus to the docs it has).
    """
    missing_ids = [i for i in doc_ids if i not in _CORPUS_CACHE]
    if missing_ids:
        missing_texts = [doc_texts[doc_ids.index(i)] for i in missing_ids]
        vectors = _post_embeddings(missing_texts)
        if vectors is not None and len(vectors) == len(missing_ids):
            for doc_id, vec in zip(missing_ids, vectors):
                _CORPUS_CACHE[doc_id] = vec

    result = {i: _CORPUS_CACHE[i] for i in doc_ids if i in _CORPUS_CACHE}
    return result or None


def cosine(a: list[float], b: list[float]) -> float:
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = sum(x * x for x in a) ** 0.5
    norm_b = sum(y * y for y in b) ** 0.5
    if norm_a == 0.0 or norm_b == 0.0:
        return 0.0
    return dot / (norm_a * norm_b)
