import { useEffect, useState } from "react";
import PropTypes from "prop-types";
import EmptyState from "./states/EmptyState";
import ErrorState from "./states/ErrorState";
import CopyButton from "./shared/CopyButton";
import BriefingSection from "./output/BriefingSection";
import Card from "./shared/Card";

const sectionShape = PropTypes.shape({
  type: PropTypes.string.isRequired,
  title: PropTypes.string.isRequired,
  content: PropTypes.string.isRequired,
});

const outputShape = PropTypes.shape({
  greeting: PropTypes.string,
  sections: PropTypes.arrayOf(sectionShape),
  briefing_script: PropTypes.string,
  errors: PropTypes.arrayOf(PropTypes.string),
  trace: PropTypes.arrayOf(PropTypes.string),
  card_traces: PropTypes.objectOf(PropTypes.arrayOf(PropTypes.string)),
});

// status: "idle" | "loading" | "success" | "error"
export default function OutputPanel({ status, output, error, onRetry }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(false);
    const id = setTimeout(() => setVisible(true), 30);
    return () => clearTimeout(id);
  }, [status]);

  function getCopyText() {
    if (!output) return "";
    const lines = (output.sections ?? []).map((s) => `${s.title}\n${s.content}`);
    return [output.greeting, ...lines].join("\n\n");
  }

  return (
    <section className="relative flex min-h-0 flex-1 flex-col bg-base">
      {(status === "success" || status === "loading") && (
        <div className="absolute right-4 top-3 z-10">
          <CopyButton getText={getCopyText} />
        </div>
      )}

      <div className="flex-1 overflow-hidden p-5 pt-4">
        <div className="state-fade h-full min-h-0" style={{ opacity: visible ? 1 : 0 }}>
          {status === "idle" && <EmptyState />}
          {status === "loading" && <LoadingContent output={output} />}
          {status === "error" && <ErrorState message={error} onRetry={onRetry} />}
          {status === "success" && output && (
            <SuccessContent output={output} />
          )}
        </div>
      </div>
    </section>
  );
}

const LOADING_SECTIONS = [
  { type: "weather", title: "Weather", detail: "Checking local conditions" },
  { type: "traffic", title: "Traffic", detail: "Looking up route conditions" },
  { type: "schedule", title: "Your Day", detail: "Reading today's agenda" },
  { type: "news", title: "Top News", detail: "Collecting topic updates" },
];

const LEFT_SECTION_TYPES = ["weather", "traffic"];

function LoadingContent({ output }) {
  const greeting = output?.greeting ?? "Preparing your briefing...";
  const sections = output?.sections ?? [];

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <p className="text-base font-semibold text-gray-100">{greeting}</p>
      <AgendaStrip section={sections.find((item) => item.type === "schedule")} trace={output?.card_traces?.schedule ?? []} isLoading />
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.95fr)]">
        <div className="grid min-h-0 grid-rows-2 gap-4">
          {LEFT_SECTION_TYPES.map((type) => renderLoadingSection(type, sections, output))}
        </div>
        <div className="min-h-0">
          {renderLoadingSection("news", sections, output, "h-full min-h-0")}
        </div>
      </div>
    </div>
  );
}

LoadingContent.propTypes = { output: outputShape };

function renderLoadingSection(type, sections, output, className = "") {
  const meta = LOADING_SECTIONS.find((item) => item.type === type);
  const loadedSection = sections.find((item) => item.type === type);
  const trace = output?.card_traces?.[type] ?? [];
  const isFinished = trace.some((item) => item.startsWith("Finished"));
  return loadedSection ? (
    <BriefingSection
      key={type}
      section={loadedSection}
      trace={trace}
      isActive={!isFinished}
      className={className}
    />
  ) : (
    <LoadingCard key={type} section={meta} trace={trace} className={className} />
  );
}

function LoadingCard({ section, trace = [], className = "" }) {
  const currentTrace = trace[trace.length - 1] ?? section.detail;
  const [label, ...details] = currentTrace.split("\n");
  return (
    <Card className={`flex h-full min-h-0 flex-col gap-3 overflow-hidden ${className}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-accent" />
          <h3 className="text-sm font-semibold text-gray-200">{section.title}</h3>
        </div>
        <span className="h-3 w-3 animate-spin rounded-full border border-accent/30 border-t-accent" />
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center px-4 py-6 text-center">
        <div className="max-w-sm">
          <span className="mx-auto block h-8 w-8 animate-spin rounded-full border-2 border-accent/25 border-t-accent" />
          <p className="mt-4 text-sm font-semibold text-gray-200">{label}</p>
          {details.map((detail) => (
            <p key={detail} className="text-anywhere mt-1 text-xs leading-relaxed text-gray-500">{detail}</p>
          ))}
        </div>
      </div>
    </Card>
  );
}

LoadingCard.propTypes = {
  section: PropTypes.shape({
    type: PropTypes.string.isRequired,
    title: PropTypes.string.isRequired,
    detail: PropTypes.string.isRequired,
  }).isRequired,
  trace: PropTypes.arrayOf(PropTypes.string),
  className: PropTypes.string,
};

function AgendaStrip({ section, trace = [], isLoading = false }) {
  const currentTrace = trace[trace.length - 1] ?? "Reading today's agenda";
  const agenda = section ? parseAgendaItems(section.content) : [];

  return (
    <div className="flex min-h-[44px] shrink-0 items-center gap-3 overflow-hidden rounded-xl border border-border bg-surface px-3 py-2">
      <span className="shrink-0 text-xs font-semibold uppercase text-gray-600">Today</span>
      {isLoading && !section ? (
        <div className="flex min-w-0 items-center gap-2 text-xs text-gray-500">
          <span className="h-3 w-3 shrink-0 animate-spin rounded-full border border-accent/30 border-t-accent" />
          <span className="truncate">{currentTrace.split("\n")[0]}</span>
        </div>
      ) : agenda.length > 0 ? (
        <div className="output-scroll flex min-w-0 flex-1 gap-2 overflow-x-auto">
          {agenda.map((item, index) => (
            <span key={`${item}-${index}`} className="shrink-0 rounded-lg border border-border bg-base/60 px-2.5 py-1 text-xs text-gray-300">
              {item}
            </span>
          ))}
        </div>
      ) : (
        <span className="truncate text-xs text-gray-500">No meetings found</span>
      )}
    </div>
  );
}

AgendaStrip.propTypes = {
  section: sectionShape,
  trace: PropTypes.arrayOf(PropTypes.string),
  isLoading: PropTypes.bool,
};

OutputPanel.propTypes = {
  status: PropTypes.oneOf(["idle", "loading", "success", "error"]).isRequired,
  output: outputShape,
  error: PropTypes.string,
  onRetry: PropTypes.func,
};

SuccessContent.propTypes = { output: outputShape.isRequired };

function SuccessContent({ output }) {
  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      {/* Greeting */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-base font-semibold text-gray-100">{output.greeting}</p>
        <span className="text-xs text-gray-600">Updated {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
      </div>
      <AgendaStrip section={(output.sections ?? []).find((item) => item.type === "schedule")} />

      {/* Briefing section cards */}
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.95fr)]">
        <div className="grid min-h-0 grid-rows-2 gap-4">
          {LEFT_SECTION_TYPES.map((type) => {
            const section = (output.sections ?? []).find((item) => item.type === type);
            return section ? <BriefingSection key={type} section={section} /> : null;
          })}
        </div>
        <div className="min-h-0">
          {(() => {
            const news = (output.sections ?? []).find((item) => item.type === "news");
            return news ? (
              <BriefingSection section={news} className="h-full min-h-0" />
            ) : null;
          })()}
        </div>
      </div>

      {(output.errors ?? []).length > 0 && (
        <div className="shrink-0 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
          <h3 className="text-sm font-semibold text-amber-200">Unavailable items</h3>
          <ul className="output-scroll text-anywhere mt-2 max-h-16 space-y-1 overflow-y-auto pr-1 text-xs text-amber-100/80">
            {output.errors.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}

    </div>
  );
}

function parseAgendaItems(content = "") {
  const text = content.replace(/^Today's schedule:\s*/i, "");
  const parts = text.includes(" · ") ? text.split(" · ") : text.split(/ Â· | Ã‚Â· /);
  return parts
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item) => !/^No meetings/i.test(item))
    .slice(0, 8);
}
