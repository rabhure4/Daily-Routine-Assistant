import logging
from datetime import datetime

from backend.nodes.geocoding import geocode_location
from backend.nodes.http_client import external_get
from backend.state import AgentState, BriefingSection

logger = logging.getLogger(__name__)

_FORECAST_URL = "https://api.open-meteo.com/v1/forecast"

_WEATHER_CODES = {
    0: "Clear sky",
    1: "Mainly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Fog",
    48: "Depositing rime fog",
    51: "Light drizzle",
    53: "Moderate drizzle",
    55: "Dense drizzle",
    61: "Slight rain",
    63: "Moderate rain",
    65: "Heavy rain",
    71: "Slight snow",
    73: "Moderate snow",
    75: "Heavy snow",
    80: "Slight rain showers",
    81: "Moderate rain showers",
    82: "Violent rain showers",
    95: "Thunderstorm",
}


def weather_agent(state: AgentState) -> dict:
    try:
        place = geocode_location(state["location"])
        resp = external_get(
            _FORECAST_URL,
            params={
                "latitude": place["latitude"],
                "longitude": place["longitude"],
                "current": "temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m",
                "hourly": "temperature_2m,precipitation_probability,weather_code",
                "forecast_days": 2,
                "timezone": "auto",
            },
            timeout=6,
        )
        resp.raise_for_status()
        data = resp.json()
        current = data["current"]

        desc = _WEATHER_CODES.get(current.get("weather_code"), "Current conditions")
        city = place["name"]
        country = place["country"]
        content = "\n".join(
            [
                (
                    f"Current: {desc} in {city}{', ' + country if country else ''}. "
                    f"Temperature {round(current['temperature_2m'])} C, "
                    f"feels like {round(current['apparent_temperature'])} C. "
                    f"Humidity {current['relative_humidity_2m']}%, "
                    f"wind {round(current['wind_speed_10m'])} km/h."
                ),
                "Forecast:",
                *_hourly_forecast_lines(data),
            ]
        )

        return {
            "weather_section": BriefingSection(
                type="weather", title="Weather", content=content
            )
        }

    except Exception as exc:
        logger.warning("weather_agent failed: %s", exc)
        try:
            content = _weather_from_duckduckgo(state["location"])
            return {
                "weather_section": BriefingSection(
                    type="weather", title="Weather", content=content
                )
            }
        except Exception as fallback_exc:
            logger.warning("weather_agent DuckDuckGo fallback failed: %s", fallback_exc)
        return {
            "weather_section": BriefingSection(
                type="weather",
                title="Weather",
                content="Weather data unavailable. Open-Meteo could not return current conditions for this location.",
            ),
            "errors": [f"Weather: {exc}"],
        }


def _weather_from_duckduckgo(location: str) -> str:
    from backend.nodes.duckduckgo import search_first

    results = search_first(
        [
            f"current weather forecast {location}",
            f"weather today {location}",
            f"3 day weather forecast {location}",
        ],
        max_results=4,
    )
    sources = _clean_source_lines(results)
    if not sources:
        raise ValueError("DuckDuckGo returned no weather fallback results")
    try:
        content = _summarize_weather_with_llm(location, results)
        return content
    except Exception as exc:
        logger.warning("weather fallback LLM summary failed: %s", exc)
    return _structured_weather_update_from_results(location, results)


def _summarize_weather_with_llm(location: str, evidence: str) -> str:
    from backend.nodes._llm import get_llm

    prompt = f"""
You are formatting fallback weather data for a dashboard card.

Location: {location}

Use only the evidence below. Do not invent exact temperatures, humidity, wind, rain chance, or hourly forecast values.
If exact numeric readings are not present, summarize the available weather update in words.
Do not include URLs, markdown links, citations, source names, or explanations.
Return exactly this plain-text structure:

Current: <condition/update and location>. Temperature <value or "not stated">. Feels like <value or "not stated">. Humidity <value or "not stated">. Wind <value or "not stated">.
Forecast:
- Now: <best available update>, temperature <value or "not stated">, rain chance <value or "not stated">
- Next 3 hours: <best available update>, temperature <value or "not stated">, rain chance <value or "not stated">
- Next 6 hours: <best available update>, temperature <value or "not stated">, rain chance <value or "not stated">
- Next 12 hours: <best available update>, temperature <value or "not stated">, rain chance <value or "not stated">
- Next 24 hours: <best available update>, temperature <value or "not stated">, rain chance <value or "not stated">

Evidence:
{evidence}
""".strip()
    content = get_llm().invoke(prompt).content.strip()
    content = _strip_code_fence(content)
    if "Current:" not in content or "Forecast:" not in content:
        raise ValueError("LLM weather summary did not return the expected structure")
    return content


def _structured_weather_update_from_results(location: str, evidence: str) -> str:
    snippets = []
    for line in evidence.splitlines():
        item = line.strip().lstrip("-* ").strip()
        if not item:
            continue
        text = item.split("(", 1)[0].strip()
        if ": " in text:
            text = text.split(": ", 1)[1].strip()
        if text:
            snippets.append(text)
    update = " ".join(snippets[:2]).strip() or "Weather update available from web search"
    update = update[:260].rstrip(" .,")
    return "\n".join(
        [
            (
                f"Current: Web weather update for {location}. "
                "Temperature not stated. Feels like not stated. "
                "Humidity not stated. Wind not stated."
            ),
            "Forecast:",
            f"- Now: {update}, temperature not stated, rain chance not stated",
            "- Next 3 hours: Detailed hourly data not stated in web results, temperature not stated, rain chance not stated",
            "- Next 6 hours: Detailed hourly data not stated in web results, temperature not stated, rain chance not stated",
            "- Next 12 hours: Detailed hourly data not stated in web results, temperature not stated, rain chance not stated",
            "- Next 24 hours: Check linked weather providers for detailed hourly forecast, temperature not stated, rain chance not stated",
        ]
    )


def _strip_code_fence(content: str) -> str:
    if content.startswith("```"):
        content = content.strip("`")
        lines = content.splitlines()
        if lines and lines[0].lower() in {"text", "plain", "plaintext"}:
            lines = lines[1:]
        return "\n".join(lines).strip()
    return content


def _clean_source_lines(results: str) -> list[str]:
    lines = []
    for line in results.splitlines():
        item = line.strip().lstrip("-* ").strip()
        if not item:
            continue
        lines.append(f"- {item}")
    return lines


def _hourly_forecast_lines(data: dict) -> list[str]:
    hourly = data.get("hourly") or {}
    times = hourly.get("time") or []
    temps = hourly.get("temperature_2m") or []
    rain = hourly.get("precipitation_probability") or []
    codes = hourly.get("weather_code") or []
    current_time = (data.get("current") or {}).get("time")
    start = _nearest_hour_index(times, current_time)
    offsets = [0, 3, 6, 12, 24]
    labels = ["Now", "Next 3 hours", "Next 6 hours", "Next 12 hours", "Next 24 hours"]
    lines = []
    for label, offset in zip(labels, offsets):
        index = min(start + offset, len(times) - 1) if times else 0
        desc = _WEATHER_CODES.get(_safe_get(codes, index), "Forecast")
        temp = _safe_round(_safe_get(temps, index))
        rain_chance = _safe_get(rain, index)
        temp_text = f"{temp} C" if temp is not None else "temperature unavailable"
        rain_text = f", rain chance {rain_chance}%" if rain_chance is not None else ""
        lines.append(f"- {label}: {desc}, {temp_text}{rain_text}")
    return lines or ["- Forecast unavailable"]


def _nearest_hour_index(times: list[str], current_time: str | None) -> int:
    if not times or not current_time:
        return 0
    try:
        current = datetime.fromisoformat(current_time)
    except ValueError:
        return 0
    best_index = 0
    best_delta = None
    for index, time_text in enumerate(times):
        try:
            delta = abs((datetime.fromisoformat(time_text) - current).total_seconds())
        except ValueError:
            continue
        if best_delta is None or delta < best_delta:
            best_index = index
            best_delta = delta
    return best_index


def _safe_get(items: list, index: int):
    return items[index] if index < len(items) else None


def _safe_round(value):
    return round(value) if isinstance(value, (int, float)) else None
