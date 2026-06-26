export default function LoadingState() {
  return (
    <div className="flex flex-col gap-4 p-1">
      {[0, 1, 2].map((i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      {/* title line */}
      <div className="skeleton mb-3 h-4 w-2/5 rounded" />
      {/* body lines */}
      <div className="flex flex-col gap-2">
        <div className="skeleton h-3 w-full rounded" />
        <div className="skeleton h-3 w-11/12 rounded" />
        <div className="skeleton h-3 w-4/5 rounded" />
      </div>
      {/* footer chip */}
      <div className="skeleton mt-4 h-3 w-1/4 rounded" />
    </div>
  );
}
