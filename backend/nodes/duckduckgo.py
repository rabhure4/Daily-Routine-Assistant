from __future__ import annotations

import hashlib
import json
import tempfile
import time
from pathlib import Path
from urllib.parse import urlencode
from typing import Iterable

from backend.nodes.http_client import external_get

_CACHE_PATH = Path(tempfile.gettempdir()) / "daily_routine_assistant" / "duckduckgo.json"
_CACHE_TTL_SECONDS = 30 * 60


def _client():
    try:
        from ddgs import DDGS
    except ImportError:
        from duckduckgo_search import DDGS
    return DDGS()


def _cache_key(kind: str, query: str, max_results: int) -> str:
    raw = f"{kind}:{max_results}:{query}".encode("utf-8")
    return hashlib.sha256(raw).hexdigest()


def _read_cache() -> dict:
    if not _CACHE_PATH.exists():
        return {}
    try:
        return json.loads(_CACHE_PATH.read_text(encoding="utf-8"))
    except Exception:
        return {}


def _write_cache(cache: dict) -> None:
    _CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
    _CACHE_PATH.write_text(json.dumps(cache, ensure_ascii=False, indent=2), encoding="utf-8")


def _get_cached(kind: str, query: str, max_results: int, allow_stale: bool = False) -> str | None:
    cache = _read_cache()
    entry = cache.get(_cache_key(kind, query, max_results))
    if not entry:
        return None
    if allow_stale or time.time() - entry.get("created_at", 0) <= _CACHE_TTL_SECONDS:
        return entry.get("content")
    return None


def _set_cached(kind: str, query: str, max_results: int, content: str) -> None:
    cache = _read_cache()
    cache[_cache_key(kind, query, max_results)] = {
        "created_at": time.time(),
        "content": content,
    }
    _write_cache(cache)


def _format_results(results: Iterable[dict], limit: int = 5) -> str:
    lines = []
    for item in list(results)[:limit]:
        title = item.get("title") or item.get("source") or "Result"
        body = item.get("body") or item.get("snippet") or item.get("description") or ""
        url = item.get("href") or item.get("url") or ""
        line = f"{title}: {body}".strip()
        if url:
            line = f"{line} ({url})"
        lines.append(line)
    if not lines:
        raise ValueError("DuckDuckGo returned no results")
    return "\n".join(lines)


def _search_html(query: str, max_results: int) -> str:
    try:
        from lxml import html
    except ImportError as exc:
        raise ValueError("lxml is required for DuckDuckGo HTML fallback") from exc

    resp = external_get(
        f"https://html.duckduckgo.com/html/?{urlencode({'q': query})}",
        headers={
            "User-Agent": "Mozilla/5.0",
            "Accept": "text/html,application/xhtml+xml",
        },
        timeout=8,
    )
    resp.raise_for_status()

    tree = html.fromstring(resp.text)
    lines = []
    for result in tree.xpath("//*[contains(concat(' ', normalize-space(@class), ' '), ' result ')]")[:max_results]:
        title_nodes = result.xpath(".//*[contains(concat(' ', normalize-space(@class), ' '), ' result__a ')]")
        snippet_nodes = result.xpath(".//*[contains(concat(' ', normalize-space(@class), ' '), ' result__snippet ')]")
        title = " ".join(title_nodes[0].text_content().split()) if title_nodes else ""
        snippet = " ".join(snippet_nodes[0].text_content().split()) if snippet_nodes else ""
        href = title_nodes[0].get("href") if title_nodes else ""
        if not title and not snippet:
            continue
        line = f"{title}: {snippet}".strip()
        if href:
            line = f"{line} ({href})"
        lines.append(line)

    if not lines:
        raise ValueError("DuckDuckGo returned no HTML results")
    return "\n".join(lines)


def search_text(query: str, max_results: int = 5) -> str:
    cached = _get_cached("text", query, max_results)
    if cached:
        return cached

    errors = []
    try:
        content = _search_html(query, max_results)
        _set_cached("text", query, max_results, content)
        return content
    except Exception as exc:
        errors.append(str(exc))

    try:
        with _client() as ddgs:
            content = _format_results(ddgs.text(query, max_results=max_results), max_results)
        _set_cached("text", query, max_results, content)
        return content
    except Exception as exc:
        errors.append(str(exc))
        stale = _get_cached("text", query, max_results, allow_stale=True)
        if stale:
            return f"{stale}\n\nNote: using cached DuckDuckGo results because live lookup failed."
        raise ValueError("; ".join(errors))


def search_first(queries: list[str], max_results: int = 5) -> str:
    errors = []
    for query in queries:
        try:
            return search_text(query, max_results=max_results)
        except Exception as exc:
            errors.append(str(exc))
    raise ValueError("; ".join(errors) or "DuckDuckGo returned no results")


def search_news(query: str, max_results: int = 5) -> str:
    # Avoid DuckDuckGo's news.js endpoint because it rate-limits aggressively.
    return search_text(query, max_results=max_results)
