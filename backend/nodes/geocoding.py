from urllib.parse import quote

from backend.config import config
from backend.nodes.http_client import external_get

_GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search"
_TOMTOM_SEARCH_URL = "https://api.tomtom.com/search/2/search/{query}.json"


def geocode_location(location: str) -> dict:
    results = []
    for query in _location_queries(location):
        resp = external_get(
            _GEOCODING_URL,
            params={"name": query, "count": 1, "language": "en", "format": "json"},
            timeout=6,
        )
        resp.raise_for_status()
        results = resp.json().get("results") or []
        if results:
            break
    if not results:
        raise ValueError(f"Could not geocode location: {location}")

    result = results[0]
    return {
        "latitude": result["latitude"],
        "longitude": result["longitude"],
        "name": result.get("name", location),
        "country": result.get("country", ""),
        "timezone": result.get("timezone", "auto"),
    }


def search_locations(query: str, limit: int = 5) -> list[dict]:
    if len(query.strip()) < 2:
        return []

    resp = external_get(
        _GEOCODING_URL,
        params={"name": query, "count": limit, "language": "en", "format": "json"},
        timeout=6,
    )
    resp.raise_for_status()

    locations = []
    for item in resp.json().get("results") or []:
        parts = [
            item.get("name"),
            item.get("admin1"),
            item.get("country"),
        ]
        label = ", ".join(part for part in parts if part)
        if not label:
            continue
        locations.append(
            {
                "label": label,
                "name": item.get("name", label),
                "country": item.get("country", ""),
                "latitude": item.get("latitude"),
                "longitude": item.get("longitude"),
                "timezone": item.get("timezone", ""),
            }
        )
    return locations


def _location_queries(location: str) -> list[str]:
    cleaned = " ".join(str(location).split())
    if not cleaned:
        return []
    queries = [cleaned]
    comma_parts = [part.strip() for part in cleaned.split(",") if part.strip()]
    if comma_parts:
        queries.append(comma_parts[0])
        if len(comma_parts) >= 2:
            queries.append(f"{comma_parts[0]}, {comma_parts[-1]}")
    deduped = []
    for query in queries:
        if query and query not in deduped:
            deduped.append(query)
    return deduped


def search_traffic_locations(query: str, limit: int = 5) -> list[dict]:
    """Street/address search for traffic routes using TomTom Search."""
    if len(query.strip()) < 2:
        return []
    if not config.tomtom_api_key:
        raise ValueError("TOMTOM_API_KEY not set")

    resp = external_get(
        _TOMTOM_SEARCH_URL.format(query=quote(query)),
        params={
            "key": config.tomtom_api_key,
            "limit": limit,
            "typeahead": "true",
            "language": "en-US",
        },
        timeout=6,
    )
    resp.raise_for_status()

    locations = []
    for item in resp.json().get("results") or []:
        position = item.get("position") or {}
        address = item.get("address") or {}
        poi = item.get("poi") or {}
        label = address.get("freeformAddress") or ", ".join(
            part for part in [poi.get("name"), address.get("municipality"), address.get("country")] if part
        )
        lat = position.get("lat")
        lon = position.get("lon")
        if not label or lat is None or lon is None:
            continue
        locations.append(
            {
                "label": label,
                "name": poi.get("name") or address.get("streetName") or label,
                "country": address.get("country", ""),
                "latitude": lat,
                "longitude": lon,
                "timezone": "",
                "provider": "traffic",
            }
        )
    return locations


def geocode_traffic_location(location: str) -> dict:
    results = search_traffic_locations(location, limit=1)
    if not results:
        raise ValueError(f"Could not geocode traffic location: {location}")
    result = results[0]
    return {
        "latitude": result["latitude"],
        "longitude": result["longitude"],
        "name": result.get("name", location),
        "country": result.get("country", ""),
    }
