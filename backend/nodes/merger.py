import logging
from datetime import datetime
from backend.state import AgentState, BriefingSection
from backend.nodes._llm import get_llm

logger = logging.getLogger(__name__)

_SECTION_ORDER = ["weather", "news", "traffic", "schedule"]


def merger(state: AgentState) -> dict:
    # Collect whichever sections succeeded
    raw: dict[str, BriefingSection] = {}
    for key in ("weather_section", "news_section", "traffic_section", "schedule_section"):
        section = state.get(key)
        if section is not None:
            raw[section["type"]] = section

    ordered_sections = [raw[t] for t in _SECTION_ORDER if t in raw]

    hour = datetime.now().hour
    if hour < 12:
        time_of_day = "morning"
    elif hour < 17:
        time_of_day = "afternoon"
    else:
        time_of_day = "evening"

    user_name = state.get("user_name", "there")
    greeting = f"Good {time_of_day}, {user_name}."

    if not ordered_sections:
        return {
            "greeting": greeting,
            "sections": [],
            "briefing_script": f"{greeting} Unfortunately, all data sources are unavailable right now.",
        }

    # Build a briefing script with natural transitions
    sections_text = "\n\n".join(
        f"[{s['title']}]\n{s['content']}" for s in ordered_sections
    )
    prompt = (
        f"You are writing a spoken morning briefing for {user_name}. "
        f"Combine the following sections into one fluent, conversational script with natural transitions. "
        f"Start with '{greeting}'. Keep it under 2 minutes when read aloud. "
        f"Do not add headers or bullet points — this will be read by a text-to-speech engine.\n\n"
        f"{sections_text}"
    )

    try:
        llm = get_llm()
        script = llm.invoke(prompt).content.strip()
    except Exception as exc:
        logger.warning("merger LLM call failed: %s", exc)
        # Fallback: concatenate sections verbatim
        script = greeting + " " + " ".join(s["content"] for s in ordered_sections)

    return {
        "greeting": greeting,
        "sections": ordered_sections,
        "briefing_script": script,
    }
