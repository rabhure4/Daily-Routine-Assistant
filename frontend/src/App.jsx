import { useCallback, useEffect, useState } from "react";
import { config } from "./config";
import { runAgentStream } from "./api/agent";
import { fetchUserConfig, saveUserConfig } from "./api/config_api";
import Navbar from "./components/Navbar";
import InputPanel from "./components/InputPanel";
import OutputPanel from "./components/OutputPanel";

const DEFAULT_FORM = {
  location: "",
  topics: [],
  traffic_from: "",
  traffic_to: "",
  traffic_stops: [],
  briefing_times: ["07:00"],
};

export default function App() {
  const [form, setForm] = useState(DEFAULT_FORM);
  const [isSaving, setIsSaving] = useState(false);

  const [status, setStatus] = useState("idle"); // idle | loading | success | error
  const [output, setOutput] = useState(null);
  const [error, setError] = useState(null);

  // Load saved preferences from backend on mount
  useEffect(() => {
    fetchUserConfig()
      .then((data) =>
        setForm({
          location: data.location ?? "",
          topics: data.topics ?? [],
          traffic_from: data.traffic_from ?? "",
          traffic_to: data.traffic_to ?? "",
          traffic_stops: data.traffic_stops ?? [],
          briefing_times: data.briefing_times ?? [data.briefing_time ?? "07:00"],
        })
      )
      .catch(() => {
        // backend not running yet — start with defaults silently
      });
  }, []);

  const handleSubmit = useCallback(async () => {
    if (status === "loading") return;
    setStatus("loading");
    setError(null);
    setOutput({
      greeting: "Preparing your briefing...",
      sections: [],
      briefing_script: "",
      errors: [],
      trace: [],
      card_traces: buildInitialCardTraces(form),
    });
    try {
      const result = await runAgentStream({
        onEvent(event) {
          if (event.type === "trace") {
            setOutput((current) => ({
              ...(current ?? {}),
              greeting: event.message,
              trace: [...(current?.trace ?? []), event.message],
            }));
          }
          if (event.type === "section") {
            setOutput((current) => {
              const existing = current?.sections ?? [];
              const sections = [
                ...existing.filter((section) => section.type !== event.section.type),
                event.section,
              ];
              return { ...(current ?? {}), sections };
            });
          }
          if (event.type === "card_trace") {
            setOutput((current) => ({
              ...(current ?? {}),
              card_traces: {
                ...(current?.card_traces ?? {}),
                [event.section_type]: appendUniqueTrace(
                  current?.card_traces?.[event.section_type] ?? [],
                  event.message
                ),
              },
            }));
          }
          if (event.type === "final") {
            setOutput({ ...event.output, card_traces: {} });
          }
        },
      });
      setOutput({ ...result, card_traces: {} });
      setStatus("success");
    } catch (err) {
      setError(err.message);
      setStatus("error");
    }
  }, [status]);

  async function handleSave() {
    setIsSaving(true);
    try {
      await saveUserConfig(form);
    } finally {
      setIsSaving(false);
    }
  }

  function handleRetry() {
    setStatus("idle");
    setError(null);
  }

  // Ctrl+Enter triggers Run Briefing from anywhere on the page
  useEffect(() => {
    function onKeyDown(e) {
      if (e.ctrlKey && e.key === "Enter") handleSubmit();
    }
    globalThis.addEventListener("keydown", onKeyDown);
    return () => globalThis.removeEventListener("keydown", onKeyDown);
  }, [handleSubmit]);

  return (
    <div
      className="flex h-screen flex-col overflow-hidden"
      style={{ "--accent": config.accentColor }}
    >
      <Navbar speechText={output?.briefing_script ?? getSectionText(output)} />
      <main className="flex flex-1 flex-col overflow-hidden pt-14 md:flex-row">
        <InputPanel
          form={form}
          setForm={setForm}
          onSubmit={handleSubmit}
          onSave={handleSave}
          isLoading={status === "loading"}
          isSaving={isSaving}
        />
        <OutputPanel
          status={status}
          output={output}
          error={error}
          onRetry={handleRetry}
        />
      </main>
    </div>
  );
}

function getSectionText(output) {
  if (!output) return "";
  const lines = (output.sections ?? []).map((section) => `${section.title}. ${section.content}`);
  return [output.greeting, ...lines].filter(Boolean).join(" ");
}

function buildInitialCardTraces(form) {
  const topics = form.topics?.length ? form.topics : ["technology"];
  return {
    weather: [
      "Starting weather lookup",
      `Resolving location\nLocation: ${form.location || "selected location"}`,
      "Requesting Open-Meteo conditions and forecast",
    ],
    traffic: [
      "Starting traffic lookup",
      "Reading selected route and stops",
      routeTraceLine(form),
      "Requesting live route traffic",
    ],
    schedule: [
      "Starting schedule lookup",
      "Reading saved agenda",
      "Preparing day summary",
    ],
    news: [
      "Starting research run",
      "Reformulating each topic into search queries",
      `Searching with DuckDuckGo\nQueries: ${topics.map((topic) => `"${topic}" latest news`).join("; ")}`,
    ],
  };
}

function routeTraceLine(form) {
  const route = [form.traffic_from, ...(form.traffic_stops ?? []), form.traffic_to]
    .map((item) => item?.trim())
    .filter(Boolean);
  return route.length >= 2
    ? `Selected route\nRoute: ${route.join(" -> ")}`
    : `Selected route\nRoute: traffic near ${form.location || "selected location"}`;
}

function appendUniqueTrace(items, message) {
  return items.includes(message) ? items : [...items, message];
}
