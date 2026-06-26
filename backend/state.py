import operator
from typing import Annotated, Optional
from typing_extensions import TypedDict


class BriefingSection(TypedDict):
    type: str      # "weather" | "news" | "traffic" | "schedule"
    title: str
    content: str


class AgentState(TypedDict):
    # Inputs (populated before graph runs)
    location: str
    topics: list[str]
    user_name: str

    # Agent outputs (each node writes its own key; None = not yet run or failed)
    weather_section: Optional[BriefingSection]
    news_section: Optional[BriefingSection]
    traffic_section: Optional[BriefingSection]
    schedule_section: Optional[BriefingSection]

    # Merger output
    greeting: Optional[str]
    briefing_script: Optional[str]      # full merged script passed to browser Web TTS
    sections: Optional[list[BriefingSection]]  # ordered list for frontend

    # Error tracking — each agent appends its own errors
    errors: Annotated[list[str], operator.add]
