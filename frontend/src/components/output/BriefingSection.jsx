import PropTypes from "prop-types";
import Card from "../shared/Card";

const BADGES = {
  weather: "WX",
  news: "NW",
  traffic: "TR",
  schedule: "DY",
};

export default function BriefingSection({ section, trace = [], isActive = false, className = "" }) {
  const badge = BADGES[section.type] ?? "IN";
  const newsItems = section.type === "news" ? toBulletItems(section.content) : [];
  const parsedNewsItems = newsItems.map(parseNewsItem);
  const newsGroups = section.type === "news" ? parseNewsGroups(section.content) : [];
  const currentTrace = trace[trace.length - 1] ?? "Working";

  return (
    <Card className={`flex h-full min-h-0 flex-col gap-2 overflow-hidden ${className}`}>
      <div className="flex shrink-0 items-center gap-2">
        <span className="flex h-6 min-w-6 items-center justify-center rounded bg-accent/15 px-1.5 text-[10px] font-semibold text-accent">
          {badge}
        </span>
        <h3 className="truncate text-sm font-semibold text-gray-200">{section.title}</h3>
      </div>

      {isActive ? (
        <CenteredTrace message={currentTrace} />
      ) : (
      <div className="output-scroll text-anywhere min-h-0 flex-1 overflow-y-auto pr-1">
        {section.type === "weather" ? (
          <WeatherDetails content={section.content} />
        ) : section.type === "traffic" ? (
          <TrafficDetails content={section.content} />
        ) : section.type === "schedule" ? (
          <ScheduleDetails content={section.content} />
        ) : newsGroups.length > 0 ? (
          <div className="space-y-4">
            {newsGroups.map((group) => (
              <section key={group.topic}>
                <h4 className="mb-2 text-xs font-semibold uppercase text-gray-500">{group.topic}</h4>
                <ul className="space-y-2 text-sm leading-relaxed text-gray-400">
                  {group.items.map((item) => (
                    <NewsItem key={`${group.topic}-${item.title}-${item.url ?? item.body}`} item={item} />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        ) : parsedNewsItems.length > 1 ? (
          <ul className="space-y-2 text-sm leading-relaxed text-gray-400">
            {parsedNewsItems.map((item) => (
              <NewsItem key={`${item.title}-${item.url ?? item.body}`} item={item} />
            ))}
          </ul>
        ) : (
          <p className="whitespace-pre-line text-sm leading-relaxed text-gray-400">
            {section.content}
          </p>
        )}
      </div>
      )}
    </Card>
  );
}

function WeatherDetails({ content }) {
  const temp = content.match(/Temperature\s+(-?\d+)/i)?.[1];
  const feels = content.match(/feels like\s+(-?\d+)/i)?.[1];
  const humidity = content.match(/Humidity\s+(\d+)%/i)?.[1];
  const wind = content.match(/wind\s+(\d+)/i)?.[1];
  const lines = content.split("\n").map((line) => line.trim()).filter(Boolean);
  const currentLine = lines.find((line) => line.startsWith("Current:")) ?? content.split(".")[0];
  const summary = currentLine.replace(/^Current:\s*/i, "");
  const forecastItems = lines
    .filter((line) => /^[-*]\s+/.test(line))
    .map((line) => line.replace(/^[-*]\s+/, ""));
  const isSourceFallback = isSourceResultBlock(lines);
  const displayForecastItems = isSourceFallback ? webWeatherForecastItems(forecastItems) : forecastItems;
  const isSparseWeather = isSparseWeatherContent(content, temp);
  const condition = isSourceFallback ? "Web weather update" : extractCondition(summary);
  const chips = [
    ["Feels", feels ? `${feels} C` : extractValue(summary, /Feels like\s+(.+?)(?:\.|$)/i)],
    ["Humidity", humidity ? `${humidity}%` : extractValue(summary, /Humidity\s+(.+?)(?:\.|$)/i)],
    ["Wind", wind ? `${wind} km/h` : extractValue(summary, /Wind\s+(.+?)(?:\.|$)/i)],
  ].map(([label, value]) => [label, value || "Not available"]);

  return (
    <div className="space-y-3 text-sm text-gray-400">
      <>
      <div className="rounded-lg border border-border bg-base/50 p-3">
        <p className="text-[11px] font-medium uppercase text-gray-600">Right Now</p>
        <div className="mt-1 flex items-end justify-between gap-3">
          <div>
            <p className="text-3xl font-semibold tracking-normal text-gray-100">{temp ? `${temp} C` : "Web"}</p>
            <p className="mt-1 text-sm font-medium text-gray-300">{condition}</p>
          </div>
          <p className="max-w-[52%] text-right text-xs leading-relaxed text-gray-500">
            {isSourceFallback ? "Showing a structured update from fallback weather results." : isSparseWeather ? "Showing structured fallback from web weather results." : compactWeatherSummary(summary)}
          </p>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {chips.map(([label, value]) => (
          <div key={label} className="rounded-lg border border-border bg-base/40 p-2">
            <p className="text-[10px] font-medium uppercase text-gray-600">{label}</p>
            <p className="mt-0.5 text-xs font-semibold text-gray-100">{value}</p>
          </div>
        ))}
      </div>
      {displayForecastItems.length > 0 && (
        <div>
          <p className="mb-1.5 text-[11px] font-medium uppercase text-gray-600">
            {displayForecastItems.some((item) => /^Now:|^Next\s+\d+\s+hours:/i.test(item)) ? "Next 24 Hours" : "Forecast"}
          </p>
          <div className="grid gap-2">
            {displayForecastItems.map((item) => {
              const [day, detail] = item.split(/:\s(.+)/);
              return (
                <div key={item} className="grid grid-cols-[82px_1fr] gap-2 rounded-lg border border-border bg-base/30 p-2">
                  <p className="text-xs font-semibold text-gray-200">{day || item}</p>
                  {detail && <p className="text-xs leading-relaxed text-gray-500">{detail}</p>}
                </div>
              );
            })}
          </div>
        </div>
      )}
      </>
    </div>
  );
}

WeatherDetails.propTypes = {
  content: PropTypes.string.isRequired,
};

function CenteredTrace({ message }) {
  const [label, ...details] = message.split("\n");
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center px-4 py-6 text-center">
      <div className="max-w-sm">
        <span className="mx-auto block h-8 w-8 animate-spin rounded-full border-2 border-accent/25 border-t-accent" />
        <p className="mt-4 text-sm font-semibold text-gray-200">{label}</p>
        {details.map((detail) => (
          <p key={detail} className="text-anywhere mt-1 text-xs leading-relaxed text-gray-500">{detail}</p>
        ))}
      </div>
    </div>
  );
}

CenteredTrace.propTypes = {
  message: PropTypes.string.isRequired,
};

function NewsItem({ item }) {
  return (
    <li className="flex gap-2">
      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
      <span className="min-w-0">
        {item.url ? (
          <a
            href={item.url}
            target="_blank"
            rel="noreferrer"
            className="font-medium text-gray-200 underline decoration-accent/50 underline-offset-2 hover:text-accent"
          >
            {item.title}
          </a>
        ) : (
          <span className="font-medium text-gray-200">{item.title}</span>
        )}
        {item.body && <span className="block text-gray-400">{item.body}</span>}
      </span>
    </li>
  );
}

NewsItem.propTypes = {
  item: PropTypes.shape({
    title: PropTypes.string.isRequired,
    body: PropTypes.string,
    url: PropTypes.string,
  }).isRequired,
};

function SourceList({ title, items }) {
  return (
    <div>
      <p className="mb-1.5 text-[11px] font-medium uppercase text-gray-600">{title}</p>
      <div className="space-y-2">
        {items.map((item) => (
          <a
            key={`${item.title}-${item.url ?? item.body}`}
            href={item.url || undefined}
            target="_blank"
            rel="noreferrer"
            className="block rounded-lg border border-border bg-base/40 p-2 transition-colors hover:border-accent/60 hover:bg-base/70"
          >
            <span className="block text-xs font-semibold text-gray-200">{item.title}</span>
            {item.body && <span className="mt-0.5 block text-xs leading-relaxed text-gray-500">{stripTrailingUrl(item.body)}</span>}
          </a>
        ))}
      </div>
    </div>
  );
}

function MetricChip({ label, value }) {
  return (
    <div className="rounded-lg border border-border bg-base/40 p-2">
      <p className="text-[10px] font-medium uppercase text-gray-600">{label}</p>
      <p className="mt-0.5 text-xs font-semibold text-gray-100">{value}</p>
    </div>
  );
}

MetricChip.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.string.isRequired,
};

SourceList.propTypes = {
  title: PropTypes.string.isRequired,
  items: PropTypes.arrayOf(
    PropTypes.shape({
      title: PropTypes.string.isRequired,
      body: PropTypes.string,
      url: PropTypes.string,
    })
  ).isRequired,
};

BriefingSection.propTypes = {
  section: PropTypes.shape({
    type: PropTypes.string.isRequired,
    title: PropTypes.string.isRequired,
    content: PropTypes.string.isRequired,
  }).isRequired,
  trace: PropTypes.arrayOf(PropTypes.string),
  isActive: PropTypes.bool,
  className: PropTypes.string,
};

function TrafficDetails({ content }) {
  const cleanedContent = content.replace(/TomTom\s*/gi, "");
  const lines = cleanedContent.split("\n").map((line) => line.trim()).filter(Boolean);
  const route = lines.find((line) => line.startsWith("Route:"))?.replace("Route:", "").trim();
  const area = lines.find((line) => line.startsWith("Area:"))?.replace("Area:", "").trim();
  const status = lines.find((line) => line.startsWith("Status:"))?.replace("Status:", "").trim();
  const total = lines.find((line) => line.startsWith("Total time:"))?.trim();
  const legs = lines.filter((line) => line.startsWith("- ")).map((line) => line.replace(/^-\s*/, ""));
  const isSourceFallback = isSourceResultBlock(lines);
  const sourceItems = isSourceFallback ? legs.map(parseNewsItem) : [];
  const eta = total?.match(/Total time:\s*([^,.]+)/i)?.[1]?.trim();
  const delay = total?.match(/,\s*([^,.]*delay)/i)?.[1]?.trim();
  const distance = total?.match(/Distance:\s*([^.]+\.)?/i)?.[1]?.replace(".", "").trim();

  if (!route && !area && !total && legs.length === 0) {
    return <p className="whitespace-pre-line text-sm leading-relaxed text-gray-400">{cleanedContent}</p>;
  }

  return (
    <div className="space-y-3 text-sm leading-relaxed text-gray-400">
      <div className="rounded-lg border border-border bg-base/50 p-3">
        <p className="text-[11px] font-medium uppercase text-gray-600">{route ? "Route" : "Area"}</p>
        <p className="mt-1 text-sm font-semibold leading-snug text-gray-100">{route || area}</p>
      </div>
      {status && <p className="rounded-lg border border-border bg-base/40 p-2 text-gray-300">{status}</p>}
      {total && (
        <div className="grid grid-cols-3 gap-2">
          <MetricChip label="ETA" value={eta || total.replace("Total time:", "").trim()} />
          <MetricChip label="Delay" value={delay || "No delay"} />
          <MetricChip label="Distance" value={distance || "N/A"} />
        </div>
      )}
      {isSourceFallback && sourceItems.length > 0 ? (
        <SourceList title="Traffic Sources" items={sourceItems} />
      ) : legs.length > 0 && (
        <details className="rounded-lg border border-border bg-base/30 p-2">
          <summary className="cursor-pointer text-xs font-semibold text-gray-300">Route legs</summary>
          <ol className="mt-2 space-y-1.5">
            {legs.map((leg, index) => (
              <li key={`${leg}-${index}`} className="rounded-lg border border-border bg-base/40 p-2 text-xs">
                <div className="flex gap-2">
                <span className="mt-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent/15 text-[10px] text-accent">
                  {index + 1}
                </span>
                <span>{leg}</span>
                </div>
              </li>
            ))}
          </ol>
        </details>
      )}
    </div>
  );
}

TrafficDetails.propTypes = {
  content: PropTypes.string.isRequired,
};

function ScheduleDetails({ content }) {
  const text = content.replace(/^Today's schedule:\s*/i, "");
  const items = text.includes(" · ") ? text.split(" · ") : text.split(" Â· ");
  const agenda = items.map((item) => item.trim()).filter(Boolean);

  if (!agenda.length || /^No meetings/i.test(content)) {
    return <p className="text-sm leading-relaxed text-gray-400">{content}</p>;
  }

  return (
    <ol className="space-y-2 text-sm text-gray-400">
      {agenda.map((item, index) => {
        const [time, ...rest] = item.split(" - ");
        return (
          <li key={`${item}-${index}`} className="grid grid-cols-[58px_1fr] gap-2 rounded-lg border border-border bg-base/40 p-2">
            <span className="font-semibold text-accent">{time}</span>
            <span className="text-gray-200">{rest.join(" - ") || item}</span>
          </li>
        );
      })}
    </ol>
  );
}

ScheduleDetails.propTypes = {
  content: PropTypes.string.isRequired,
};

function toBulletItems(content) {
  const explicitBullets = content
    .split("\n")
    .map((line) => line.trim().replace(/^[-*]\s+/, ""))
    .filter(Boolean);

  if (explicitBullets.length > 1) return explicitBullets;

  return content
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+(?=[A-Z0-9])/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 5);
}

function parseNewsItem(item) {
  const linkMatch = item.match(/\s+\(([^()]+)\)\s*$/);
  const rawUrl = linkMatch?.[1] ?? "";
  const text = linkMatch ? item.slice(0, linkMatch.index).trim() : item.trim();
  const separator = text.indexOf(": ");
  const title = separator > -1 ? text.slice(0, separator).trim() : text;
  const body = separator > -1 ? text.slice(separator + 2).trim() : "";

  return {
    title: title || "News item",
    body,
    url: rawUrl ? normalizeUrl(rawUrl) : "",
  };
}

function parseNewsGroups(content) {
  const groups = [];
  let current = null;

  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith("## ")) {
      current = { topic: trimmed.replace(/^##\s+/, ""), items: [] };
      groups.push(current);
      continue;
    }
    if (current && /^[-*]\s+/.test(trimmed)) {
      current.items.push(parseNewsItem(trimmed.replace(/^[-*]\s+/, "")));
    }
  }

  return groups.filter((group) => group.items.length > 0);
}

function normalizeUrl(rawUrl) {
  const absolute = rawUrl.startsWith("//") ? `https:${rawUrl}` : rawUrl;
  try {
    const url = new URL(absolute);
    const duckDuckGoTarget = url.searchParams.get("uddg");
    return duckDuckGoTarget ? decodeURIComponent(duckDuckGoTarget) : url.toString();
  } catch {
    return absolute;
  }
}

function stripTrailingUrl(text) {
  return text.replace(/\s*\((?:https?:)?\/\/[^()]+\)\s*$/i, "").trim();
}

function isSourceResultBlock(lines) {
  return lines.some((line) => /^Sources:/i.test(line)) ||
    lines.some((line) => /from web search/i.test(line)) ||
    lines.some((line) => /duckduckgo\.com\/l\/\?uddg=|https?:\/\/|\/\/[a-z0-9.-]+\//i.test(line));
}

function extractCondition(summary) {
  const beforeTemp = summary.split(/Temperature\s+/i)[0]?.trim();
  return beforeTemp?.replace(/\.$/, "") || "Weather details";
}

function extractValue(text, regex) {
  const value = text.match(regex)?.[1]?.trim();
  if (!value || /available from (?:these sources|web sources)/i.test(value)) return "";
  return value.replace(/^not stated$/i, "Not stated");
}

function compactWeatherSummary(summary) {
  return summary
    .replace(/\s*Temperature\s+.+$/i, "")
    .replace(/\.$/, "")
    .trim() || "Current weather summary";
}

function sourceFallbackForecastItems() {
  return [
    "Now: Not available from web results, temperature Not available, rain chance Not available",
    "Next 3 hours: Not available from web results, temperature Not available, rain chance Not available",
    "Next 6 hours: Not available from web results, temperature Not available, rain chance Not available",
    "Next 12 hours: Not available from web results, temperature Not available, rain chance Not available",
    "Next 24 hours: Not available from web results, temperature Not available, rain chance Not available",
  ];
}

function webWeatherForecastItems(items) {
  const updates = items
    .map((item) => parseNewsItem(item))
    .map((item) => stripWeatherSourceNoise(item.body || item.title))
    .filter(Boolean);
  const primary = updates[0] || "Weather providers have current and hourly updates for this location";
  const secondary = updates[1] || primary;
  return [
    `Now: ${primary}, temperature not stated, rain chance not stated`,
    `Next 3 hours: ${secondary}, temperature not stated, rain chance not stated`,
    "Next 6 hours: Hourly details are available from fallback weather results, temperature not stated, rain chance not stated",
    "Next 12 hours: Detailed local forecast requires the weather provider page, temperature not stated, rain chance not stated",
    "Next 24 hours: Check the hourly forecast provider for exact hour-by-hour values, temperature not stated, rain chance not stated",
  ];
}

function stripWeatherSourceNoise(text) {
  return stripTrailingUrl(text)
    .replace(/\s*\((?:https?:)?\/\/[^()]+\)\s*/gi, " ")
    .replace(/(?:\/\/)?duckduckgo\.com\/l\/\?uddg=[^\s)]+/gi, " ")
    .replace(/\s+/g, " ")
    .replace(/\s+\.\.\.$/, "...")
    .trim();
}

function isSparseWeatherContent(content, temp) {
  if (temp) return false;
  const unavailableCount = (content.match(/not available/gi) ?? []).length;
  return unavailableCount >= 3 || /from web search|available from these sources|duckduckgo\.com\/l\/\?uddg=|not stated/i.test(content);
}
