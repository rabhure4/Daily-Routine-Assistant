import logging

from backend.config import config
from backend.nodes.geocoding import geocode_location, geocode_traffic_location
from backend.nodes.http_client import external_get
from backend.state import AgentState, BriefingSection

logger = logging.getLogger(__name__)

_TOMTOM_FLOW_URL = "https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json"
_TOMTOM_ROUTE_URL = "https://api.tomtom.com/routing/1/calculateRoute/{points}/json"


def traffic_agent(state: AgentState) -> dict:
    try:
        if not config.tomtom_api_key:
            raise ValueError("TOMTOM_API_KEY not set")

        route_points = _configured_route()
        if len(route_points) >= 2:
            content = _route_traffic(route_points)
            return {
                "traffic_section": BriefingSection(
                    type="traffic", title="Traffic", content=content
                )
            }

        place = geocode_location(state["location"])
        resp = external_get(
            _TOMTOM_FLOW_URL,
            params={
                "point": f"{place['latitude']},{place['longitude']}",
                "unit": "KMPH",
                "key": config.tomtom_api_key,
            },
            timeout=6,
        )
        resp.raise_for_status()
        data = resp.json()["flowSegmentData"]

        current_speed = round(data["currentSpeed"])
        free_flow_speed = round(data["freeFlowSpeed"])
        confidence = data.get("confidence")
        road_closure = data.get("roadClosure", False)

        if road_closure:
            content = f"Traffic reports a road closure near {state['location']}."
        elif free_flow_speed > 0:
            slowdown = max(0, round((1 - current_speed / free_flow_speed) * 100))
            content = (
                f"Traffic near {state['location']}: current speed about "
                f"{current_speed} km/h versus {free_flow_speed} km/h free-flow. "
                f"Estimated slowdown {slowdown}%."
            )
            if confidence is not None:
                content += f" Confidence {round(confidence * 100)}%."
        else:
            content = f"Traffic near {state['location']}: current speed about {current_speed} km/h."

        return {
            "traffic_section": BriefingSection(
                type="traffic", title="Traffic", content=content
            )
        }

    except Exception as exc:
        logger.warning("traffic_agent failed: %s", exc)
        try:
            content = _traffic_from_duckduckgo(state["location"])
            return {
                "traffic_section": BriefingSection(
                    type="traffic", title="Traffic", content=content
                )
            }
        except Exception as fallback_exc:
            logger.warning("traffic_agent DuckDuckGo fallback failed: %s", fallback_exc)
        return {
            "traffic_section": BriefingSection(
                type="traffic",
                title="Traffic",
                content="Traffic data unavailable. The traffic service could not return route or flow data.",
            ),
            "errors": [f"Traffic: {exc}"],
        }


def _configured_route() -> list[str]:
    points = []
    start = getattr(config, "traffic_from", "")
    destination = getattr(config, "traffic_to", "")
    stops = getattr(config, "traffic_stops", []) or []
    if start:
        points.append(start)
    points.extend(stop for stop in stops if stop)
    if destination:
        points.append(destination)
    return points


def _traffic_from_duckduckgo(location: str) -> str:
    from backend.nodes.duckduckgo import search_first

    route_points = _configured_route()
    if len(route_points) >= 2:
        route = " -> ".join(route_points)
        queries = [
            f"live traffic route {route}",
            f"traffic conditions from {route_points[0]} to {route_points[-1]}",
            f"road traffic delay {route}",
        ]
        title = f"Route: {route}"
    else:
        queries = [
            f"live traffic conditions {location}",
            f"traffic congestion near {location}",
            f"road traffic updates {location}",
        ]
        title = f"Area: {location}"

    results = search_first(queries, max_results=4)
    sources = _clean_source_lines(results)
    if not sources:
        raise ValueError("DuckDuckGo returned no traffic fallback results")
    return "\n".join([title, "Status: Live traffic details are available from web sources.", "Sources:", *sources[:4]])


def _clean_source_lines(results: str) -> list[str]:
    lines = []
    for line in results.splitlines():
        item = line.strip().lstrip("-* ").strip()
        if item:
            lines.append(f"- {item}")
    return lines


def _route_traffic(points: list[str]) -> str:
    legs = []
    total_seconds = 0
    total_delay = 0
    total_meters = 0

    for index in range(len(points) - 1):
        origin = geocode_traffic_location(points[index])
        destination = geocode_traffic_location(points[index + 1])
        summary = _route_summary(origin, destination)
        total_seconds += summary["travelTimeInSeconds"]
        total_delay += summary.get("trafficDelayInSeconds", 0)
        total_meters += summary.get("lengthInMeters", 0)
        legs.append(
            "- "
            f"{points[index]} -> {points[index + 1]}: "
            f"{_minutes(summary['travelTimeInSeconds'])} min"
            f"{_delay_text(summary.get('trafficDelayInSeconds', 0))}"
        )

    route = " -> ".join(points)
    summary = (
        f"Route: {route}\n"
        f"Total time: {_minutes(total_seconds)} min"
        f"{_delay_text(total_delay)}. "
        f"Distance: {total_meters / 1000:.1f} km."
    )
    return summary + "\n" + "\n".join(legs)


def _route_summary(origin: dict, destination: dict) -> dict:
    points = (
        f"{origin['latitude']},{origin['longitude']}:"
        f"{destination['latitude']},{destination['longitude']}"
    )
    resp = external_get(
        _TOMTOM_ROUTE_URL.format(points=points),
        params={
            "routeType": "fastest",
            "traffic": "true",
            "travelMode": "car",
            "key": config.tomtom_api_key,
        },
        timeout=8,
    )
    resp.raise_for_status()
    routes = resp.json().get("routes") or []
    if not routes:
        raise ValueError("Traffic route service returned no routes")
    return routes[0]["summary"]


def _minutes(seconds: int) -> int:
    return max(1, round(seconds / 60))


def _delay_text(seconds: int) -> str:
    minutes = round(seconds / 60)
    if minutes <= 0:
        return ", no traffic delay"
    return f", {minutes} min traffic delay"
