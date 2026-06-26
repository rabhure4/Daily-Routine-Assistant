import { config } from "../config";
import WebTTSPlayer from "./output/WebTTSPlayer";

export default function Navbar({ speechText = "" }) {
  return (
    <header className="fixed inset-x-0 top-0 z-50 flex h-14 items-center justify-between border-b border-border bg-base px-4 md:px-6">
      {/* Left: logo placeholder + project name */}
      <div className="flex items-center gap-2.5">
        <LogoIcon />
        <span className="text-sm font-semibold text-gray-100">
          {config.projectName}
        </span>
      </div>

      <div className="mx-4 hidden min-w-0 flex-1 justify-center md:flex">
        <WebTTSPlayer text={speechText} compact />
      </div>

      {/* Right: GitHub link */}
      <div className="flex items-center gap-3">
        <a
          href={config.githubUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-gray-500 transition-colors hover:text-gray-300"
          aria-label="GitHub"
        >
          <GitHubIcon />
        </a>
      </div>
    </header>
  );
}

function LogoIcon() {
  return (
    <div className="flex h-7 w-7 items-center justify-center rounded-md bg-accent">
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="white"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
      </svg>
    </div>
  );
}

function GitHubIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="currentColor"
    >
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z" />
    </svg>
  );
}
