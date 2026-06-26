import logging
import yaml
from datetime import datetime
from pathlib import Path
from backend.state import AgentState, BriefingSection

logger = logging.getLogger(__name__)

_CONFIG_PATH = Path(__file__).parent.parent / "user_config.yaml"
_WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]


def schedule_agent(state: AgentState) -> dict:
    try:
        raw = yaml.safe_load(_CONFIG_PATH.read_text(encoding="utf-8"))
        agenda = raw.get("agenda", {})
        today_key = _WEEKDAYS[datetime.now().weekday()]
        items: list[str] = agenda.get(today_key, [])

        if not items:
            content = "No meetings or events scheduled for today. Enjoy a free day!"
        else:
            content = "Today's schedule: " + " · ".join(items)

        return {
            "schedule_section": BriefingSection(
                type="schedule", title="Your Day", content=content
            )
        }

    except Exception as exc:
        logger.warning("schedule_agent failed: %s", exc)
        return {
            "schedule_section": None,
            "errors": [f"Schedule: {exc}"],
        }
