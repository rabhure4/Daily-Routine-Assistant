import PropTypes from "prop-types";

export default function CardTraceTimeline({ items, isActive = false }) {
  const visibleItems = items.length ? items : ["Waiting for source response"];

  return (
    <div className="shrink-0 border-t border-border/70 pt-2">
      <div className="mb-1 flex items-center justify-between">
        <p className="text-[10px] font-medium uppercase text-gray-600">Trace</p>
        {isActive && <span className="h-3 w-3 animate-spin rounded-full border border-accent/30 border-t-accent" />}
      </div>
      <ol className="output-scroll max-h-28 overflow-y-auto pr-1 text-[11px]">
        {visibleItems.map((rawItem, index) => {
          const isCurrent = isActive && index === visibleItems.length - 1;
          const isError = /^warning:|error:/i.test(rawItem);
          const [label, ...details] = rawItem.split("\n");
          return (
            <li key={`${rawItem}-${index}`} className="grid grid-cols-[16px_1fr] gap-2">
              <span className="relative flex justify-center">
                {index < visibleItems.length - 1 && (
                  <span className="absolute left-1/2 top-3 h-full w-px -translate-x-1/2 bg-accent/70" />
                )}
                {isCurrent ? (
                  <span className="relative mt-1 h-2.5 w-2.5 animate-spin rounded-full border border-accent/30 border-t-accent" />
                ) : (
                  <span className={`relative mt-1 h-2 w-2 rounded-full ${isError ? "bg-red-400" : "bg-accent"}`} />
                )}
              </span>
              <span className="text-anywhere pb-2">
                <span className={isError ? "text-red-300" : isCurrent ? "text-gray-200" : "text-gray-400"}>
                  {label}
                </span>
                {details.map((detail) => (
                  <span
                    key={detail}
                    className={isError ? "mt-1 block text-red-300/80" : "mt-1 block text-gray-500"}
                  >
                    {detail}
                  </span>
                ))}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

CardTraceTimeline.propTypes = {
  items: PropTypes.arrayOf(PropTypes.string),
  isActive: PropTypes.bool,
};
