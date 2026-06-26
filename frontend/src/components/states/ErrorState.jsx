import Button from "../shared/Button";

export default function ErrorState({ message, onRetry }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-6 text-center">
      <div className="flex flex-col items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10 text-red-400">
          <ErrorIcon />
        </div>
        <div>
          <p className="mb-1 text-sm font-medium text-red-400">
            Something went wrong
          </p>
          <p className="max-w-sm text-xs text-gray-500">
            {message || "An unexpected error occurred. Please try again."}
          </p>
        </div>
      </div>
      <Button variant="danger" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}

function ErrorIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}
