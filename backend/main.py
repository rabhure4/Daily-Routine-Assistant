import logging
import asyncio
import json
from contextlib import asynccontextmanager
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from backend.config import config, save_user_config
from backend.graph import graph
from backend.nodes.merger import merger
from backend.nodes.geocoding import search_locations, search_traffic_locations
from backend.nodes.news_agent import news_agent
from backend.nodes.schedule_agent import schedule_agent
from backend.nodes.traffic_agent import traffic_agent
from backend.nodes.weather_agent import weather_agent
from backend.scheduler import reschedule_briefings, start_scheduler, shutdown_scheduler

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    start_scheduler()
    yield
    shutdown_scheduler()


app = FastAPI(title="Daily Routine Assistant", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # tighten in production
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── /run ─────────────────────────────────────────────────────────────────────

class RunResponse(BaseModel):
    greeting: str
    sections: list[dict]
    briefing_script: str = ""
    errors: list[str] = Field(default_factory=list)
    trace: list[str] = Field(default_factory=list)
    card_traces: dict[str, list[str]] = Field(default_factory=dict)


@app.post("/run", response_model=RunResponse)
async def run_briefing():
    """Manual trigger — runs the full multi-agent graph and returns the briefing."""
    initial_state = _initial_state()
    try:
        result = graph.invoke(initial_state)
    except Exception as exc:
        logger.error("Graph execution failed: %s", exc)
        raise HTTPException(status_code=500, detail=str(exc))

    return RunResponse(
        greeting=result.get("greeting", "Good morning."),
        sections=result.get("sections", []),
        briefing_script=result.get("briefing_script", ""),
        errors=result.get("errors", []),
        trace=_build_trace(result),
        card_traces=_build_card_traces(result),
    )


@app.post("/run/stream")
async def run_briefing_stream():
    """Manual trigger with newline-delimited JSON progress events."""
    return StreamingResponse(_stream_briefing(), media_type="application/x-ndjson")


async def _stream_briefing():
    def event(kind: str, **payload):
        return json.dumps({"type": kind, **payload}, ensure_ascii=False) + "\n"

    initial_state = _initial_state()
    aggregate = {**initial_state, "errors": []}
    card_traces: dict[str, list[str]] = {key: [] for key in ("weather", "news", "traffic", "schedule")}
    yield event("trace", message="Started briefing run")

    node_specs = {
        "weather": ("Weather", weather_agent),
        "news": ("Top News", news_agent),
        "traffic": ("Traffic", traffic_agent),
        "schedule": ("Your Day", schedule_agent),
    }
    tasks = {
        asyncio.create_task(asyncio.to_thread(fn, initial_state)): (section_type, title)
        for section_type, (title, fn) in node_specs.items()
    }
    for section_type, (title, _) in node_specs.items():
        initial_messages = _initial_card_trace(section_type, title, initial_state)
        for message in initial_messages:
            card_traces[section_type].append(message)
            yield event("card_trace", section_type=section_type, message=message)
        yield event("trace", message=f"Queued {title}")

    pending = set(tasks)
    while pending:
        done, pending = await asyncio.wait(pending, return_when=asyncio.FIRST_COMPLETED)
        for task in done:
            section_type, title = tasks[task]
            try:
                result = task.result()
            except Exception as exc:
                result = {"errors": [f"{title}: {exc}"]}

            errors = result.get("errors", [])
            aggregate.update({key: value for key, value in result.items() if key != "errors"})
            for error in errors:
                aggregate["errors"].append(error)
                card_traces[section_type].append(f"Warning: {error}")
                yield event("card_trace", section_type=section_type, message=f"Warning: {error}")
                yield event("trace", message=f"Warning: {error}")

            section = result.get(f"{section_type}_section")
            if section:
                for message in _completion_card_trace(section_type):
                    card_traces[section_type].append(message)
                    yield event("card_trace", section_type=section_type, message=message)
                yield event("section", section=section)
                card_traces[section_type].append(f"Finished {title}")
                yield event("card_trace", section_type=section_type, message=f"Finished {title}")
                yield event("trace", message=f"Finished {title}")

    yield event("trace", message="Merging briefing script with selected LLM")
    merged = await asyncio.to_thread(merger, aggregate)
    aggregate.update(merged)
    final = RunResponse(
        greeting=aggregate.get("greeting", "Good morning."),
        sections=aggregate.get("sections", []),
        briefing_script=aggregate.get("briefing_script", ""),
        errors=aggregate.get("errors", []),
        trace=_build_trace(aggregate),
        card_traces=card_traces,
    )
    yield event("final", output=final.model_dump())


def _initial_card_trace(section_type: str, title: str, state: dict) -> list[str]:
    if section_type == "news":
        topics = state.get("topics") or ["technology"]
        queries = []
        for topic in topics:
            topic = str(topic).strip()
            if topic:
                queries.append(f'"{topic}" latest news')
        return [
            "Starting research run",
            "Reformulating each topic into search queries",
            "Searching with DuckDuckGo\nQueries: " + "; ".join(queries),
        ]
    if section_type == "weather":
        location = state.get("location") or "selected location"
        return [
            "Starting weather lookup",
            f"Resolving location\nLocation: {location}",
            "Requesting Open-Meteo conditions and forecast",
        ]
    if section_type == "traffic":
        return [
            "Starting traffic lookup",
            "Reading selected route and stops",
            "Requesting live route traffic",
        ]
    if section_type == "schedule":
        return [
            "Starting schedule lookup",
            "Reading saved agenda",
            "Preparing day summary",
        ]
    return [f"Queued {title}", "Waiting for source response"]


def _completion_card_trace(section_type: str) -> list[str]:
    if section_type == "news":
        return [
            "Collected results",
            "Checking whether results are sufficient",
            "Synthesizing final answer",
        ]
    if section_type == "weather":
        return ["Collected weather data", "Formatting current conditions and forecast"]
    if section_type == "traffic":
        return ["Collected traffic data", "Formatting ETA, delay, and route notes"]
    if section_type == "schedule":
        return ["Collected schedule data", "Formatting agenda"]
    return ["Rendered briefing card"]


def _build_trace(result: dict) -> list[str]:
    trace = [
        "Started briefing run",
        "Collected weather, news, traffic, and schedule inputs",
    ]
    sections = result.get("sections", [])
    if sections:
        trace.append(
            "Built sections: " + ", ".join(section.get("title", "Untitled") for section in sections)
        )
    if result.get("briefing_script"):
        trace.append("Prepared spoken briefing script")
    trace.append("Prepared browser Web TTS script")
    for error in result.get("errors", []):
        trace.append(f"Warning: {error}")
    trace.append("Finished briefing run")
    return trace


def _build_card_traces(result: dict) -> dict[str, list[str]]:
    traces = {key: [] for key in ("weather", "news", "traffic", "schedule")}
    title_to_type = {
        "Weather": "weather",
        "Top News": "news",
        "Traffic": "traffic",
        "Your Day": "schedule",
    }
    for section in result.get("sections", []):
        section_type = section.get("type") or title_to_type.get(section.get("title", ""))
        if section_type in traces:
            traces[section_type] = [
                f"Started {section.get('title', section_type)}",
                "Collected source response",
                "Rendered briefing card",
                f"Finished {section.get('title', section_type)}",
            ]
    for error in result.get("errors", []):
        prefix = error.split(":", 1)[0].strip().lower()
        if prefix in traces:
            traces[prefix].insert(2, f"Warning: {error}")
    return traces


def _initial_state() -> dict:
    return {
        "location": config.location,
        "topics": config.topics,
        "user_name": config.user_name,
        "errors": [],
    }


@app.get("/locations")
async def locations(q: str):
    try:
        return {"locations": search_locations(q)}
    except Exception as exc:
        logger.warning("location search failed: %s", exc)
        raise HTTPException(status_code=502, detail="Location search failed")


@app.get("/traffic-locations")
async def traffic_locations(q: str):
    try:
        return {"locations": search_traffic_locations(q)}
    except Exception as exc:
        logger.warning("traffic location search failed: %s", exc)
        raise HTTPException(status_code=502, detail="Traffic location search failed")


# ── /config ───────────────────────────────────────────────────────────────────

class UserConfigIn(BaseModel):
    user_name: Optional[str] = None
    location: Optional[str] = None
    topics: Optional[list[str]] = None
    traffic_from: Optional[str] = None
    traffic_to: Optional[str] = None
    traffic_stops: Optional[list[str]] = None
    briefing_time: Optional[str] = None
    briefing_times: Optional[list[str]] = None


@app.get("/config")
async def get_config():
    """Return current user preferences (safe fields only — no secrets)."""
    return config.as_user_dict()


@app.post("/config")
async def update_config(body: UserConfigIn):
    """Persist updated preferences to user_config.yaml."""
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    if "briefing_times" in updates:
        times = [t for t in updates["briefing_times"] if t]
        if not times:
            raise HTTPException(status_code=400, detail="At least one briefing time is required")
        updates["briefing_times"] = times
        updates["briefing_time"] = times[0]
    elif "briefing_time" in updates:
        updates["briefing_times"] = [updates["briefing_time"]]
    save_user_config(updates)
    reschedule_briefings()
    return {"status": "saved"}
