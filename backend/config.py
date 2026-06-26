import os
from pathlib import Path
from typing import Optional
import yaml
from dotenv import load_dotenv

_CONFIG_PATH = Path(__file__).parent / "user_config.yaml"
_ENV_PATH = Path(__file__).parent / ".env"

load_dotenv(_ENV_PATH)


def _load_yaml() -> dict:
    with open(_CONFIG_PATH, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


def save_user_config(data: dict) -> None:
    """Merge incoming data into user_config.yaml, preserving unset keys."""
    current = _load_yaml()
    current.update(data)
    with open(_CONFIG_PATH, "w", encoding="utf-8") as f:
        yaml.dump(current, f, allow_unicode=True, sort_keys=False)


class Config:
    """Single config object populated from .env + user_config.yaml.
    Re-read user_config.yaml on each access so POST /config takes effect immediately.
    """

    # ── env-only (secrets) ──
    llm_provider: Optional[str] = os.getenv("LLM_PROVIDER")
    llm_model: Optional[str] = os.getenv("LLM_MODEL")
    openai_api_key: Optional[str] = os.getenv("OPENAI_API_KEY")
    openrouter_api_key: Optional[str] = os.getenv("OPENROUTER_API_KEY")
    openrouter_base_url: str = os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1")
    openrouter_app_name: str = os.getenv("OPENROUTER_APP_NAME", "Daily Routine Assistant")
    openrouter_site_url: str = os.getenv("OPENROUTER_SITE_URL", "http://localhost")
    gemini_api_key: Optional[str] = os.getenv("GEMINI_API_KEY")
    ollama_base_url: str = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
    tomtom_api_key: Optional[str] = os.getenv("TOMTOM_API_KEY")
    external_api_verify_tls: bool = os.getenv("EXTERNAL_API_VERIFY_TLS", "false").lower() in {
        "1",
        "true",
        "yes",
    }

    def __getattr__(self, name: str):
        """Fall through to user_config.yaml for any non-secret attribute."""
        data = _load_yaml()
        if name in data:
            return data[name]
        raise AttributeError(f"Config has no attribute '{name}'")

    def as_user_dict(self) -> dict:
        """Return only the user-facing fields (safe to expose via GET /config)."""
        data = _load_yaml()
        return {
            "user_name": data.get("user_name", ""),
            "location": data.get("location", ""),
            "timezone": data.get("timezone", "UTC"),
            "topics": data.get("topics", []),
            "traffic_from": data.get("traffic_from", ""),
            "traffic_to": data.get("traffic_to", ""),
            "traffic_stops": data.get("traffic_stops", []),
            "briefing_time": data.get("briefing_time", "07:00"),
            "briefing_times": data.get("briefing_times", [data.get("briefing_time", "07:00")]),
        }


config = Config()
