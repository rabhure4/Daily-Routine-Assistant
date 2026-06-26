import axios from "axios";
import { config } from "../config";

const BASE = config.apiBaseUrl;

export async function fetchUserConfig() {
  const res = await axios.get(`${BASE}/config`);
  return res.data;
}

export async function saveUserConfig(payload) {
  const res = await axios.post(`${BASE}/config`, payload);
  return res.data;
}

export async function searchLocations(query) {
  if (!query.trim()) return [];
  try {
    const res = await axios.get(`${BASE}/locations`, { params: { q: query } });
    return res.data.locations ?? [];
  } catch {
    const res = await axios.get("https://geocoding-api.open-meteo.com/v1/search", {
      params: { name: query, count: 5, language: "en", format: "json" },
    });
    return (res.data.results ?? []).map((item) => {
      const parts = [item.name, item.admin1, item.country].filter(Boolean);
      return {
        label: parts.join(", "),
        name: item.name,
        country: item.country ?? "",
        latitude: item.latitude,
        longitude: item.longitude,
        timezone: item.timezone ?? "",
      };
    });
  }
}

export async function searchTrafficLocations(query) {
  if (!query.trim()) return [];
  const res = await axios.get(`${BASE}/traffic-locations`, { params: { q: query } });
  return res.data.locations ?? [];
}
