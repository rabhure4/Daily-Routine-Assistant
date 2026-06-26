import { useEffect, useRef, useState } from "react";
import { config } from "../config";
import { searchLocations, searchTrafficLocations } from "../api/config_api";
import Button from "./shared/Button";

export default function InputPanel({
  onSubmit,
  onSave,
  isLoading,
  isSaving,
  form,
  setForm,
}) {
  const [topicInput, setTopicInput] = useState("");
  const [openSection, setOpenSection] = useState("location");
  const [isCollapsed, setIsCollapsed] = useState(false);

  function addTopic(event) {
    if ((event.key === "Enter" || event.key === ",") && topicInput.trim()) {
      event.preventDefault();
      const next = topicInput.trim().replace(/,$/, "");
      if (next && !form.topics.includes(next)) {
        setForm((current) => ({ ...current, topics: [...current.topics, next] }));
      }
      setTopicInput("");
    }
  }

  function removeTopic(topic) {
    setForm((current) => ({
      ...current,
      topics: current.topics.filter((item) => item !== topic),
    }));
  }

  function addTrafficStop() {
    setForm((current) => ({
      ...current,
      traffic_stops: [...(current.traffic_stops ?? []), ""],
    }));
  }

  function updateTrafficStop(index, value) {
    setForm((current) => ({
      ...current,
      traffic_stops: (current.traffic_stops ?? []).map((stop, i) => (i === index ? value : stop)),
    }));
  }

  function removeTrafficStop(index) {
    setForm((current) => ({
      ...current,
      traffic_stops: (current.traffic_stops ?? []).filter((_, i) => i !== index),
    }));
  }

  function addBriefingTime() {
    setForm((current) => ({
      ...current,
      briefing_times: [...current.briefing_times, "07:00"],
    }));
  }

  function updateBriefingTime(index, value) {
    setForm((current) => ({
      ...current,
      briefing_times: current.briefing_times.map((time, i) => (i === index ? value : time)),
    }));
  }

  function removeBriefingTime(index) {
    setForm((current) => ({
      ...current,
      briefing_times: current.briefing_times.filter((_, i) => i !== index),
    }));
  }

  function toggleSection(section) {
    setOpenSection((current) => (current === section ? "" : section));
  }

  return (
    <aside className={`flex w-full shrink-0 flex-col border-b border-border bg-base transition-[width] md:h-full md:border-b-0 md:border-r ${isCollapsed ? "md:w-[76px]" : "md:w-[360px]"}`}>
      <div className={`border-b border-border ${isCollapsed ? "px-3 py-4" : "px-5 py-5"}`}>
        <div className="flex items-center justify-between gap-3">
          {!isCollapsed && (
            <div className="min-w-0">
              <h1 className="truncate text-lg font-semibold text-gray-100">{config.projectName}</h1>
              <p className="mt-1 text-sm text-gray-500">{config.description}</p>
            </div>
          )}
          <button
            type="button"
            onClick={() => setIsCollapsed((current) => !current)}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-sm text-gray-300 transition-colors hover:border-accent hover:text-accent"
            aria-label={isCollapsed ? "Expand settings" : "Collapse settings"}
            title={isCollapsed ? "Expand settings" : "Collapse settings"}
          >
            {isCollapsed ? ">" : "<"}
          </button>
        </div>
      </div>

      {isCollapsed ? (
        <div className="flex flex-1 flex-col items-center gap-3 px-3 py-4">
          <button
            type="button"
            onClick={() => setIsCollapsed(false)}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-surface text-xs font-semibold text-gray-300 hover:border-accent hover:text-accent"
            title="Settings"
            aria-label="Settings"
          >
            Set
          </button>
        </div>
      ) : (
      <div className="flex-1 overflow-y-auto px-5 py-5">
        <div className="flex flex-col gap-3">
          <SettingsSection
            title="Location"
            isOpen={openSection === "location"}
            onToggle={() => toggleSection("location")}
          >
            <Field label="Weather Location">
              <LocationInput
                value={form.location}
                onChange={(value) => setForm((current) => ({ ...current, location: value }))}
                placeholder="Search city or area"
                searchFn={searchLocations}
              />
            </Field>

            <Field label="Traffic Route" hint="ETA with stops">
              <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-2">
                <LocationInput
                  value={form.traffic_from ?? ""}
                  onChange={(value) => setForm((current) => ({ ...current, traffic_from: value }))}
                  placeholder="From street or place"
                  searchFn={searchTrafficLocations}
                />
                {(form.traffic_stops ?? []).map((stop, index) => (
                  <div key={index} className="flex gap-2">
                    <LocationInput
                      value={stop}
                      onChange={(value) => updateTrafficStop(index, value)}
                      placeholder={`Stop ${index + 1}`}
                      searchFn={searchTrafficLocations}
                    />
                    <button
                      type="button"
                      onClick={() => removeTrafficStop(index)}
                      className="h-10 w-10 shrink-0 rounded-lg border border-border bg-base text-sm text-gray-400 transition-colors hover:border-accent hover:text-accent"
                      aria-label="Remove stop"
                    >
                      -
                    </button>
                  </div>
                ))}
                <LocationInput
                  value={form.traffic_to ?? ""}
                  onChange={(value) => setForm((current) => ({ ...current, traffic_to: value }))}
                  placeholder="To street or place"
                  searchFn={searchTrafficLocations}
                />
                <button
                  type="button"
                  onClick={addTrafficStop}
                  className="h-9 rounded-lg border border-border bg-base text-sm text-gray-300 transition-colors hover:border-accent hover:text-accent"
                >
                  Add Stop
                </button>
              </div>
            </Field>
          </SettingsSection>

          <SettingsSection
            title="News"
            isOpen={openSection === "news"}
            onToggle={() => toggleSection("news")}
          >
            <Field label="News Topics" hint="Each topic is searched separately">
              <div className="flex flex-wrap gap-1.5 rounded-lg border border-border bg-surface p-2 transition-colors focus-within:border-accent">
                {form.topics.map((topic) => (
                  <span
                    key={topic}
                    className="flex items-center gap-1 rounded-md bg-accent/10 px-2 py-0.5 text-xs text-accent"
                  >
                    {topic}
                    <button
                      onClick={() => removeTopic(topic)}
                      className="ml-0.5 text-accent/60 hover:text-accent"
                      aria-label={`Remove ${topic}`}
                    >
                      x
                    </button>
                  </span>
                ))}
                <input
                  type="text"
                  value={topicInput}
                  onChange={(event) => setTopicInput(event.target.value)}
                  onKeyDown={addTopic}
                  placeholder={form.topics.length === 0 ? "AI, India, Tech..." : ""}
                  className="min-w-[80px] flex-1 bg-transparent text-sm text-gray-200 placeholder-gray-600 outline-none"
                />
              </div>
            </Field>
          </SettingsSection>

          <SettingsSection
            title="Timing"
            isOpen={openSection === "timing"}
            onToggle={() => toggleSection("timing")}
          >
            <Field label="Briefing Times">
              <div className="flex flex-col gap-2">
                {form.briefing_times.map((time, index) => (
                  <div key={`${time}-${index}`} className="flex gap-2">
                    <input
                      type="time"
                      value={time}
                      onChange={(event) => updateBriefingTime(index, event.target.value)}
                      className="input"
                    />
                    <button
                      type="button"
                      onClick={() => removeBriefingTime(index)}
                      disabled={form.briefing_times.length === 1}
                      className="h-10 w-10 shrink-0 rounded-lg border border-border bg-surface text-sm text-gray-400 transition-colors hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-40"
                      aria-label="Remove briefing time"
                    >
                      -
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addBriefingTime}
                  className="h-9 rounded-lg border border-border bg-surface text-sm text-gray-300 transition-colors hover:border-accent hover:text-accent"
                >
                  Add Time
                </button>
              </div>
            </Field>
          </SettingsSection>
        </div>
      </div>
      )}

      <div className={`flex flex-col gap-2 border-t border-border ${isCollapsed ? "px-3 py-4" : "px-5 py-4"}`}>
        {isCollapsed ? (
          <button
            type="button"
            disabled={isLoading}
            onClick={onSubmit}
            className="flex h-11 w-11 items-center justify-center rounded-lg bg-accent text-xs font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
            title={config.submitLabel}
            aria-label={config.submitLabel}
          >
            {isLoading ? <Spinner /> : "Run"}
          </button>
        ) : (
          <>
            <Button className="w-full" disabled={isLoading} onClick={onSubmit} type="submit">
              {isLoading && <Spinner />}
              {config.submitLabel}
            </Button>
            <Button variant="ghost" className="w-full" disabled={isSaving} onClick={onSave}>
              {isSaving ? "Saving..." : "Save Preferences"}
            </Button>
            {isLoading && <p className="text-center text-xs text-gray-500">{config.loadingText}</p>}
          </>
        )}
      </div>
    </aside>
  );
}

function LocationInput({ value, onChange, placeholder, searchFn = searchLocations }) {
  const [suggestions, setSuggestions] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchError, setSearchError] = useState("");
  const searchId = useRef(0);
  const selectedValue = useRef("");

  useEffect(() => {
    const query = value.trim();
    if (query && query === selectedValue.current) {
      setSuggestions([]);
      setIsSearching(false);
      setSearchError("");
      return;
    }
    if (query.length < 2) {
      setSuggestions([]);
      setIsSearching(false);
      setSearchError("");
      return;
    }

    const nextSearchId = searchId.current + 1;
    searchId.current = nextSearchId;
    setIsSearching(true);
    setSearchError("");

    const timeout = setTimeout(() => {
      searchFn(query)
        .then((items) => {
          if (searchId.current !== nextSearchId) return;
          setSuggestions(items);
          setSearchError(items.length ? "" : "No matching locations found");
          setShowSuggestions(true);
        })
        .catch(() => {
          if (searchId.current !== nextSearchId) return;
          setSuggestions([]);
          setSearchError("Location search is unavailable");
          setShowSuggestions(true);
        })
        .finally(() => {
          if (searchId.current === nextSearchId) setIsSearching(false);
        });
    }, 250);

    return () => clearTimeout(timeout);
  }, [searchFn, value]);

  return (
    <div className="relative min-w-0 flex-1">
      <input
        type="text"
        value={value}
        onChange={(event) => {
          onChange(event.target.value);
          setShowSuggestions(true);
        }}
        onFocus={() => setShowSuggestions(suggestions.length > 0)}
        onBlur={() => setTimeout(() => setShowSuggestions(false), 120)}
        placeholder={placeholder}
        className="input pr-20"
      />
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-gray-600">
        {isSearching ? "Searching" : "Search"}
      </span>
      {showSuggestions && (suggestions.length > 0 || searchError) && (
        <div className="output-scroll absolute left-0 right-0 top-[calc(100%+6px)] z-30 max-h-56 overflow-y-auto rounded-lg border border-border bg-surface shadow-xl">
          {suggestions.map((item) => (
            <button
              key={`${item.label}-${item.latitude}-${item.longitude}`}
              type="button"
              className="flex w-full flex-col gap-0.5 border-b border-border/70 px-3 py-2 text-left last:border-b-0 hover:bg-white/[0.03]"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                selectedValue.current = item.label;
                onChange(item.label);
                setSuggestions([]);
                setSearchError("");
                setShowSuggestions(false);
              }}
            >
              <span className="text-sm text-gray-200">{item.label}</span>
              {item.timezone && <span className="text-[11px] text-gray-600">{item.timezone}</span>}
            </button>
          ))}
          {searchError && suggestions.length === 0 && (
            <div className="px-3 py-2 text-sm text-gray-500">{searchError}</div>
          )}
        </div>
      )}
    </div>
  );
}

function SettingsSection({ title, isOpen, onToggle, children }) {
  return (
    <section className="rounded-lg border border-border bg-surface/50">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between px-3 py-3 text-left text-sm font-semibold text-gray-200"
      >
        <span>{title}</span>
        <span className="text-xs text-gray-500">{isOpen ? "Hide" : "Show"}</span>
      </button>
      {isOpen && <div className="flex flex-col gap-4 border-t border-border px-3 py-3">{children}</div>}
    </section>
  );
}

function Field({ label, hint, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between">
        <label className="text-xs font-medium text-gray-400">{label}</label>
        {hint && <span className="text-[10px] text-gray-600">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}
