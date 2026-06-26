import axios from "axios";
import { config } from "../config";

// POST /run — no request body needed; backend reads user_config.yaml directly
export async function runAgent() {
  try {
    const response = await axios.post(`${config.apiBaseUrl}/run`);
    return response.data;
  } catch (err) {
    const message =
      err.response?.data?.detail ||
      err.response?.data?.message ||
      (err.message ? `${err.message} (${config.apiBaseUrl}/run)` : "") ||
      "An unexpected error occurred.";
    throw new Error(message);
  }
}

export async function runAgentStream({ onEvent } = {}) {
  let response;
  try {
    response = await fetch(`${config.apiBaseUrl}/run/stream`, { method: "POST" });
  } catch (err) {
    onEvent?.({
      type: "trace",
      message: `Streaming unavailable at ${config.apiBaseUrl}/run/stream (${err.message}); using standard run endpoint`,
    });
    return runAgent();
  }
  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    try {
      const data = await response.json();
      message = data.detail || data.message || message;
    } catch {
      // Keep the status message if the response is not JSON.
    }
    throw new Error(message);
  }
  if (!response.body) {
    return runAgent();
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let finalOutput = null;

  try {
    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.trim()) continue;
        const event = JSON.parse(line);
        onEvent?.(event);
        if (event.type === "final") {
          finalOutput = event.output;
        }
      }

      if (done) break;
    }
  } catch (err) {
    onEvent?.({
      type: "trace",
      message: `Streaming interrupted at ${config.apiBaseUrl}/run/stream (${err.message}); using standard run endpoint`,
    });
    return runAgent();
  }

  if (buffer.trim()) {
    const event = JSON.parse(buffer);
    onEvent?.(event);
    if (event.type === "final") {
      finalOutput = event.output;
    }
  }

  if (!finalOutput) {
    throw new Error("Briefing stream ended before a final response was received.");
  }
  return finalOutput;
}
