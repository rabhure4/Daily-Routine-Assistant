import logging

from backend.state import AgentState, BriefingSection

logger = logging.getLogger(__name__)

_MAX_ARTICLES = 5


def _as_bullets(results: str) -> str:
    lines = []
    for line in results.splitlines():
        item = line.strip().lstrip("-* ").strip()
        if item:
            lines.append(f"- {item}")
    return "\n".join(lines[:_MAX_ARTICLES]) if lines else results


def news_agent(state: AgentState) -> dict:
    try:
        from backend.nodes.duckduckgo import search_first

        topics = state["topics"] if state["topics"] else ["technology"]
        sections = []
        errors = []
        for topic in topics:
            topic = topic.strip()
            if not topic:
                continue
            try:
                bullets = search_first(
                    [
                        f'"{topic}" latest news',
                        f'"{topic}" news today',
                        f'"{topic}" latest headlines',
                    ],
                    max_results=3,
                )
                sections.append(f"## {topic}\n{_as_bullets(bullets)}")
            except Exception as exc:
                logger.warning("news topic lookup failed for %s: %s", topic, exc)
                sections.append(
                    f"## {topic}\n- News lookup unavailable for this topic. Please try again later."
                )
                errors.append(f"News {topic}: {exc}")

        if not sections:
            sections.append("## technology\n- News lookup unavailable. No topics were provided.")

        result = {
            "news_section": BriefingSection(
                type="news", title="Top News", content="\n\n".join(sections)
            )
        }
        if errors:
            result["errors"] = errors
        return result

    except Exception as exc:
        logger.warning("news_agent failed: %s", exc)
        return {
            "news_section": BriefingSection(
                type="news",
                title="Top News",
                content="News data unavailable. DuckDuckGo lookup did not return usable results.",
            ),
            "errors": [f"News: {exc}"],
        }
